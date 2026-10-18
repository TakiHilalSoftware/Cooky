import "server-only";

import { eq } from "drizzle-orm";

import { PAYMENT_GRACE_DAYS, PLAN_RANK, type Plan } from "@config/plans";
import type { Executor } from "@/server/db/client";
import { entitlements, subscriptions } from "@/server/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

type SubscriptionRow = typeof subscriptions.$inferSelect;

/**
 * Whether a subscription currently grants its plan. Trialing and active do;
 * past due does during the 7-day grace after the first failed payment
 * (PRD §3.7), then the person is back on Free.
 */
export function grantsPlan(sub: SubscriptionRow, now: Date): boolean {
  if (sub.status === "trialing" || sub.status === "active") return true;
  if (sub.status === "past_due" && sub.paymentFailedAt) {
    return now.getTime() < sub.paymentFailedAt.getTime() + PAYMENT_GRACE_DAYS * DAY_MS;
  }
  return false;
}

/** How long the grant lasts: the period end, extended to the end of any grace. */
function grantEnd(sub: SubscriptionRow): Date {
  if (sub.status === "past_due" && sub.paymentFailedAt) {
    const graceEnd = new Date(sub.paymentFailedAt.getTime() + PAYMENT_GRACE_DAYS * DAY_MS);
    return graceEnd > sub.currentPeriodEnd ? graceEnd : sub.currentPeriodEnd;
  }
  return sub.currentPeriodEnd;
}

/**
 * Rewrites the person's entitlement from their subscriptions: the best plan
 * any subscription currently grants, or Free. An admin comp that's still
 * running is never downgraded by billing. Returns the change, if any.
 */
export async function recomputeEntitlement(
  userId: string,
  tx: Executor,
  now = new Date(),
): Promise<{ from: Plan; to: Plan }> {
  const [current] = await tx.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
  const from: Plan = current?.plan ?? "free";

  const best = (await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId)))
    .filter((sub) => grantsPlan(sub, now))
    .sort((a, b) => PLAN_RANK[b.plan] - PLAN_RANK[a.plan])[0];

  const compRunning = current?.source === "comp" && (!current.periodEnd || current.periodEnd > now);
  if (compRunning && (!best || PLAN_RANK[best.plan] <= PLAN_RANK[current.plan])) return { from, to: from };

  if (!best) {
    await tx.delete(entitlements).where(eq(entitlements.userId, userId));
    return { from, to: "free" };
  }

  const values = {
    plan: best.plan,
    source: best.status === "trialing" ? ("trial" as const) : ("stripe" as const),
    periodStart: best.currentPeriodStart,
    periodEnd: grantEnd(best),
  };
  await tx
    .insert(entitlements)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: entitlements.userId, set: values });
  return { from, to: best.plan };
}
