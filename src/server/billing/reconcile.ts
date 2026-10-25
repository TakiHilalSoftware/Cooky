import "server-only";

import { inArray, ne, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { billingCustomers, entitlements, subscriptions } from "@/server/db/schema";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/server/features/billing/service";
import { logger } from "@/server/observability/logger";

import { recomputeEntitlement } from "./entitlements";
import { getStripe } from "./stripe";
import { syncSubscription } from "./sync";

/** Mirrors every subscription Stripe has for one customer. Returns their ids and owners. */
async function mirrorCustomer(customerId: string): Promise<{ ids: string[]; owners: Set<string> }> {
  const db = getDb();
  const ids: string[] = [];
  const owners = new Set<string>();
  for await (const sub of getStripe().subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
    const synced = await db.transaction((tx) => syncSubscription(sub, tx));
    ids.push(sub.id);
    if (synced) owners.add(synced.userId);
  }
  return { ids, owners };
}

/**
 * Mirrors one customer's subscriptions and recomputes the owner's plan.
 * Catches up on webhooks that never arrived (a listener that was down, a
 * delivery still retrying) before anything is decided from the mirror.
 */
export async function reconcileCustomer(customerId: string): Promise<void> {
  const { owners } = await mirrorCustomer(customerId);
  for (const userId of owners) await getDb().transaction((tx) => recomputeEntitlement(userId, tx));
}

/**
 * Nightly reconcile (ARCHITECTURE §5.3): re-reads every customer's
 * subscriptions from Stripe (so one whose webhooks were lost is found too),
 * then recomputes every entitlement, which also ends grace periods and
 * trials whose time ran out. Returns how many plans changed.
 */
export async function reconcileBilling(now = new Date()): Promise<{ synced: number; changed: number }> {
  const db = getDb();
  const seen = new Set<string>();
  for (const { id } of await db.select({ id: billingCustomers.stripeCustomerId }).from(billingCustomers)) {
    try {
      for (const subId of (await mirrorCustomer(id)).ids) seen.add(subId);
    } catch (err) {
      logger.error({ err, customerId: id }, "reconcile: customer sync failed");
    }
  }
  // Mirrored subscriptions whose customer row is gone still get refreshed.
  const live = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(ne(subscriptions.status, "canceled"));
  for (const { id } of live.filter((sub) => !seen.has(sub.id))) {
    try {
      const fresh = await getStripe().subscriptions.retrieve(id);
      await db.transaction((tx) => syncSubscription(fresh, tx));
      seen.add(id);
    } catch (err) {
      logger.error({ err, subscriptionId: id }, "reconcile: subscription sync failed");
    }
  }

  const doubleBilled = (
    await db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES]))
      .groupBy(subscriptions.userId)
      .having(sql`count(*) > 1`)
  ).map((r) => r.userId);
  // Checkout refuses a second subscription, so this only happens if that guard is bypassed: refund by hand.
  if (doubleBilled.length > 0)
    logger.error({ userIds: doubleBilled }, "reconcile: people with more than one live subscription");

  const people = new Set([
    ...(await db.select({ userId: subscriptions.userId }).from(subscriptions)).map((r) => r.userId),
    ...(await db.select({ userId: entitlements.userId }).from(entitlements)).map((r) => r.userId),
  ]);
  let changed = 0;
  for (const userId of people) {
    const change = await db.transaction((tx) => recomputeEntitlement(userId, tx, now));
    if (change.from !== change.to) changed++;
  }
  if (changed > 0) logger.warn({ changed }, "reconcile: entitlements drifted and were corrected");
  return { synced: seen.size, changed };
}
