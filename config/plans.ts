/**
 * Plans as Stripe and the pricing UI know them (PRD §3.7, prices are a
 * proposal). Only ids, display prices and Stripe lookup keys live here;
 * limits are in the `plan_limits` table (scripts/seed-plan-limits.ts).
 */
export const PAID_PLANS = ["plus", "pro"] as const;
export const PLANS = ["free", ...PAID_PLANS] as const;
export const INTERVALS = ["month", "year"] as const;

export type Plan = (typeof PLANS)[number];
export type PaidPlan = (typeof PAID_PLANS)[number];
export type BillingInterval = (typeof INTERVALS)[number];

/** Display prices in euro cents. Stripe holds the real prices (pnpm stripe:sync). */
export const PLAN_PRICES: Record<PaidPlan, Record<BillingInterval, number>> = {
  plus: { month: 399, year: 3599 },
  pro: { month: 799, year: 6999 },
};

/** Stripe price lookup keys, so no price ids live in env or code. */
export function stripeLookupKey(plan: PaidPlan, interval: BillingInterval): string {
  return `cooky_${plan}_${interval}`;
}

/** PRD §3.7: a 7-day trial, once per account. */
export const TRIAL_DAYS = 7;

/** PRD §3.7: after a failed payment the plan stays for 7 days, then Free. */
export const PAYMENT_GRACE_DAYS = 7;
