// Which counting window a try falls in (ARCHITECTURE §5.2). Pure, so the
// boundaries are unit-tested. All times are UTC.
import type { LimitPeriod } from "@/lib/plan-features";

/** Counted and gated features have no window: one counter for all time. */
export const NO_PERIOD = new Date(0);

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  // Clamp to the month's last day (Jan 31 + 1 month = Feb 28/29).
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * Start of the monthly window containing `now`, stepping a month at a time
 * from `anchor` (the billing date). Yearly subscribers get monthly allowances
 * too, anchored to their billing day.
 */
export function monthlyWindowStart(anchor: Date, now: Date): Date {
  if (now < anchor) return anchor;
  let months = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  let start = addUtcMonths(anchor, months);
  while (start > now) start = addUtcMonths(anchor, --months);
  return start;
}

/**
 * Free: the UTC calendar month. Paid: monthly windows from the billing
 * anchor. Spins: the UTC day.
 */
export function periodStartFor(period: LimitPeriod, billingAnchor: Date | null, now: Date): Date {
  if (period === "none") return NO_PERIOD;
  if (period === "day") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (billingAnchor) return monthlyWindowStart(billingAnchor, now);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the window that starts at `start` ends (for "resets on …" in the UI). */
export function periodEndFor(period: LimitPeriod, start: Date, billingAnchor: Date | null): Date | null {
  if (period === "none") return null;
  if (period === "day") return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (billingAnchor) {
    const months =
      (start.getUTCFullYear() - billingAnchor.getUTCFullYear()) * 12 +
      (start.getUTCMonth() - billingAnchor.getUTCMonth());
    return addUtcMonths(billingAnchor, months + 1);
  }
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}
