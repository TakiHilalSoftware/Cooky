import "server-only";

import { PAYMENT_GRACE_DAYS, PLAN_PRICES, type PaidPlan } from "@config/plans";
import { grantsPlan } from "@/server/billing/entitlements";
import type { subscriptions } from "@/server/db/schema";
import type { Entitlement } from "@/server/quota/entitlement";
import type { UsageSnapshot } from "@/server/quota/tries";
import type { MeteredFeature } from "@/lib/plan-features";

import type { BillingStatusDto, PlanPricesDto, PlanSource, UsageDto } from "./dto";

type SubscriptionRow = typeof subscriptions.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Subscriptions Stripe still bills (or retries): checkout is refused, the portal handles changes. */
export const LIVE_SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due"] as const;

export function isLive(sub: Pick<SubscriptionRow, "status">): boolean {
  return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status);
}

export function sourceOf(entitlement: Entitlement): PlanSource {
  if (entitlement.plan === "free" || !entitlement.source) return "free";
  return entitlement.source === "stripe" ? "paid" : entitlement.source;
}

export function pricesOf(plan: PaidPlan): PlanPricesDto {
  return PLAN_PRICES[plan];
}

/** How much cheaper a year is than twelve monthly payments, rounded down so we never overstate it. */
export function yearlySavingsPercent(prices: PlanPricesDto): number {
  return Math.floor((1 - prices.year / (prices.month * 12)) * 100);
}

/**
 * The plan line of Settings → Plan & billing: which plan, from where, and
 * what happens next. The entitlement decides the plan (the same one the
 * quota uses); the subscription that grants it supplies the dates.
 */
export function describePlan(
  entitlement: Entitlement,
  subs: SubscriptionRow[],
  now: Date,
): Pick<BillingStatusDto, "plan" | "source" | "interval" | "priceCents" | "next"> {
  const source = sourceOf(entitlement);
  const plan = entitlement.plan;
  if (plan === "free") return { plan, source, interval: null, priceCents: null, next: { kind: "none" } };
  if (source === "comp") {
    const next = entitlement.periodEnd
      ? ({ kind: "ends", at: entitlement.periodEnd.toISOString() } as const)
      : ({ kind: "none" } as const);
    return { plan, source, interval: null, priceCents: null, next };
  }

  const sub = subs
    .filter((s) => s.plan === plan && grantsPlan(s, now))
    .sort((a, b) => b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime())[0];
  // The entitlement is ahead of the mirror (a webhook in flight): show the plan without dates.
  if (!sub) return { plan, source, interval: null, priceCents: null, next: { kind: "none" } };

  const periodEnd = (sub.status === "trialing" ? sub.trialEnd : null) ?? sub.currentPeriodEnd;
  const base = { plan, source, interval: sub.interval, priceCents: PLAN_PRICES[sub.plan][sub.interval] };
  if (sub.status === "past_due" && sub.paymentFailedAt) {
    const graceEnd = new Date(sub.paymentFailedAt.getTime() + PAYMENT_GRACE_DAYS * DAY_MS);
    return { ...base, next: { kind: "grace", at: graceEnd.toISOString() } };
  }
  if (sub.cancelAtPeriodEnd) return { ...base, next: { kind: "ends", at: periodEnd.toISOString() } };
  if (sub.status === "trialing") return { ...base, next: { kind: "trial_converts", at: periodEnd.toISOString() } };
  return { ...base, next: { kind: "renews", at: periodEnd.toISOString() } };
}

export function toUsageDto(snapshot: UsageSnapshot & { feature: MeteredFeature }): UsageDto {
  return {
    feature: snapshot.feature,
    limit: snapshot.limit,
    remaining: snapshot.remaining,
    period: snapshot.period,
    resetsAt: snapshot.resetsAt?.toISOString() ?? null,
  };
}
