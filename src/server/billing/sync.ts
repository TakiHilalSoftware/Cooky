import "server-only";

import { eq } from "drizzle-orm";

import type { Executor } from "@/server/db/client";
import { billingCustomers, subscriptionStatusEnum, subscriptions } from "@/server/db/schema";

import { planFromLookupKey } from "./plans";
import type { Stripe } from "./stripe";
import { recordTrial } from "./trial";

type SubscriptionRow = typeof subscriptions.$inferSelect;

type Status = (typeof subscriptionStatusEnum.enumValues)[number];

/** Stripe may add statuses; an unknown one is stored as "incomplete", which grants no plan. */
function toStatus(status: string): Status {
  return subscriptionStatusEnum.enumValues.find((known) => known === status) ?? "incomplete";
}

const toDate = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/** Which Cooky account a Stripe subscription belongs to. */
async function ownerOf(sub: Stripe.Subscription, tx: Executor): Promise<string | null> {
  const fromMetadata = sub.metadata?.userId;
  if (fromMetadata) return fromMetadata;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const [row] = await tx
    .select({ userId: billingCustomers.userId })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

/**
 * Mirrors a Stripe subscription into the database and records a trial the
 * first time one is used. Returns the owner and the row before and after, or
 * null for subscriptions that aren't Cooky plans.
 */
export async function syncSubscription(
  sub: Stripe.Subscription,
  tx: Executor,
): Promise<{ userId: string; before: SubscriptionRow | null; after: SubscriptionRow } | null> {
  const userId = await ownerOf(sub, tx);
  const item = sub.items.data[0];
  const mapped = planFromLookupKey(item?.price.lookup_key);
  if (!userId || !item || !mapped) return null;

  const [before] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
  const values = {
    userId,
    plan: mapped.plan,
    interval: mapped.interval,
    status: toStatus(sub.status),
    // In this API version billing periods live on the subscription items.
    currentPeriodStart: toDate(item.current_period_start) ?? new Date(),
    currentPeriodEnd: toDate(item.current_period_end) ?? new Date(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEnd: toDate(sub.trial_end),
  };
  const [after] = await tx
    .insert(subscriptions)
    .values({ id: sub.id, ...values })
    .onConflictDoUpdate({ target: subscriptions.id, set: values })
    .returning();

  if (sub.trial_end) await recordTrial(userId, mapped.plan, tx);
  return { userId, before: before ?? null, after: after! };
}
