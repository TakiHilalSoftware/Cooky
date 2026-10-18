import { INTERVALS, PAID_PLANS, type BillingInterval, type PaidPlan } from "@config/plans";

/** Reads plan and interval from a price's lookup key ("cooky_plus_month"). */
export function planFromLookupKey(
  lookupKey: string | null | undefined,
): { plan: PaidPlan; interval: BillingInterval } | null {
  const match = lookupKey?.match(/^cooky_([a-z]+)_([a-z]+)$/);
  const plan = PAID_PLANS.find((p) => p === match?.[1]);
  const interval = INTERVALS.find((i) => i === match?.[2]);
  return plan && interval ? { plan, interval } : null;
}
