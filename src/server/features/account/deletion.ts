import "server-only";

import { and, eq, inArray, lt } from "drizzle-orm";

import { DELETION_GRACE_DAYS } from "@/lib/admin";
import { audit } from "@/server/audit/audit";
import { getStripe } from "@/server/billing/stripe";
import { keepTrialAfterPurge } from "@/server/billing/trial";
import { getDb, type Executor } from "@/server/db/client";
import { billingCustomers, session, subscriptions, user } from "@/server/db/schema";
import { env } from "@/server/env";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/server/features/billing/service";
import { logger } from "@/server/observability/logger";
import { deleteObjects, listKeys, storageConfigured } from "@/server/storage/r2";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the 7-day grace (PRD §3.1): the account counts as signed out
 * everywhere and its sessions end. Logging in again within the grace cancels
 * it. The subscription is cancelled by the outbox job that's queued with this.
 */
export async function scheduleDeletion(tx: Executor, userId: string, now = new Date()) {
  await tx.update(user).set({ status: "pending_deletion", deletionRequestedAt: now }).where(eq(user.id, userId));
  await tx.delete(session).where(eq(session.userId, userId));
}

/** When a scheduled deletion becomes final. */
export function purgeDateFor(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS);
}

/** Cancels the person's live Stripe subscriptions right away (deleting an account must not keep charging). */
export async function cancelSubscriptions(userId: string): Promise<number> {
  const live = await getDb()
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])));
  if (live.length === 0 || !env.STRIPE_SECRET_KEY) return 0;
  for (const sub of live) {
    try {
      await getStripe().subscriptions.cancel(sub.id);
    } catch (err) {
      // Already gone on Stripe's side is fine; anything else retries via the outbox.
      if ((err as { code?: string }).code !== "resource_missing") throw err;
    }
  }
  return live.length;
}

/**
 * Removes an account for good: the Stripe customer (which also ends any
 * subscription), every stored object under its prefix, then the user row,
 * which cascades to everything they own. Safe to re-run after a failure.
 */
export async function purgeAccount(userId: string, actorId: string | null = null): Promise<void> {
  const db = getDb();
  const [customer] = await db
    .select({ id: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);
  if (customer && env.STRIPE_SECRET_KEY) {
    try {
      await getStripe().customers.del(customer.id);
    } catch (err) {
      if ((err as { code?: string }).code !== "resource_missing") throw err;
    }
  }
  if (storageConfigured()) {
    const keys = await listKeys(`u/${userId}/`);
    await deleteObjects(keys);
  }
  await db.transaction(async (tx) => {
    await keepTrialAfterPurge(userId, tx);
    await tx.delete(user).where(eq(user.id, userId));
    await audit(tx, { actorId, action: "account.purged", targetType: "user", targetId: userId });
  });
}

/** The daily job: accounts whose grace ended. One failure never blocks the others. */
export async function purgeDueAccounts(now = new Date()): Promise<{ purged: number; failed: number }> {
  const due = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.status, "pending_deletion"),
        lt(user.deletionRequestedAt, new Date(now.getTime() - DELETION_GRACE_DAYS * DAY_MS)),
      ),
    );
  let purged = 0;
  let failed = 0;
  for (const { id } of due) {
    try {
      await purgeAccount(id);
      purged++;
    } catch (err) {
      failed++;
      logger.error({ err, userId: id }, "account purge failed; will retry tomorrow");
    }
  }
  return { purged, failed };
}
