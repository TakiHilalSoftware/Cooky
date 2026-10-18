import { describe, expect, it } from "vitest";

import { PLAN_PRICES } from "@config/plans";
import type { subscriptions } from "@/server/db/schema";
import type { Entitlement } from "@/server/quota/entitlement";

import { describePlan, isLive, sourceOf, yearlySavingsPercent } from "./service";

type SubscriptionRow = typeof subscriptions.$inferSelect;

const NOW = new Date("2026-10-18T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

const FREE: Entitlement = { plan: "free", source: null, billingAnchor: null, periodEnd: null };

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return { plan: "plus", source: "stripe", billingAnchor: days(-10), periodEnd: days(20), ...overrides };
}

function sub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub_1",
    userId: "u1",
    plan: "plus",
    interval: "month",
    status: "active",
    currentPeriodStart: days(-10),
    currentPeriodEnd: days(20),
    cancelAtPeriodEnd: false,
    trialEnd: null,
    paymentFailedAt: null,
    createdAt: days(-10),
    updatedAt: days(-10),
    ...overrides,
  };
}

describe("describePlan", () => {
  it("Free has no price, no interval and nothing coming up", () => {
    expect(describePlan(FREE, [], NOW)).toEqual({
      plan: "free",
      source: "free",
      interval: null,
      priceCents: null,
      next: { kind: "none" },
    });
  });

  it("a paid plan renews at the period end, at that plan and interval's price", () => {
    const yearly = sub({ interval: "year", currentPeriodEnd: days(300) });
    expect(describePlan(entitlement(), [yearly], NOW)).toEqual({
      plan: "plus",
      source: "paid",
      interval: "year",
      priceCents: PLAN_PRICES.plus.year,
      next: { kind: "renews", at: days(300).toISOString() },
    });
  });

  it("a trial converts when the trial ends", () => {
    const trial = sub({ status: "trialing", trialEnd: days(5), currentPeriodEnd: days(5) });
    expect(describePlan(entitlement({ source: "trial" }), [trial], NOW)).toMatchObject({
      source: "trial",
      next: { kind: "trial_converts", at: days(5).toISOString() },
    });
  });

  it("a cancelled trial ends instead of converting", () => {
    const trial = sub({ status: "trialing", trialEnd: days(5), currentPeriodEnd: days(5), cancelAtPeriodEnd: true });
    expect(describePlan(entitlement({ source: "trial" }), [trial], NOW).next).toEqual({
      kind: "ends",
      at: days(5).toISOString(),
    });
  });

  it("a cancelled paid plan ends at the period end", () => {
    expect(describePlan(entitlement(), [sub({ cancelAtPeriodEnd: true })], NOW).next).toEqual({
      kind: "ends",
      at: days(20).toISOString(),
    });
  });

  it("after a failed payment, the plan runs until 7 days after the first failure", () => {
    const pastDue = sub({ status: "past_due", paymentFailedAt: days(-2) });
    expect(describePlan(entitlement(), [pastDue], NOW).next).toEqual({ kind: "grace", at: days(5).toISOString() });
  });

  it("grace wins over a pending cancellation: the payment problem is the urgent part", () => {
    const pastDue = sub({ status: "past_due", paymentFailedAt: days(-1), cancelAtPeriodEnd: true });
    expect(describePlan(entitlement(), [pastDue], NOW).next.kind).toBe("grace");
  });

  it("describes the subscription that grants the plan, not an older cancelled one", () => {
    const old = sub({ id: "sub_old", status: "canceled", plan: "plus", currentPeriodEnd: days(-40) });
    const pro = sub({ id: "sub_new", plan: "pro", interval: "year", currentPeriodEnd: days(200) });
    expect(describePlan(entitlement({ plan: "pro" }), [old, pro], NOW)).toMatchObject({
      plan: "pro",
      priceCents: PLAN_PRICES.pro.year,
      next: { kind: "renews", at: days(200).toISOString() },
    });
  });

  it("a comp shows its end date, or nothing when it never ends, and no price", () => {
    expect(describePlan(entitlement({ source: "comp", periodEnd: days(30) }), [], NOW)).toMatchObject({
      source: "comp",
      priceCents: null,
      next: { kind: "ends", at: days(30).toISOString() },
    });
    expect(describePlan(entitlement({ source: "comp", periodEnd: null }), [], NOW).next).toEqual({ kind: "none" });
  });

  it("a comp outranking a cheaper subscription is still shown as the comp", () => {
    const plus = sub();
    expect(describePlan(entitlement({ plan: "pro", source: "comp", periodEnd: null }), [plus], NOW)).toMatchObject({
      plan: "pro",
      source: "comp",
      priceCents: null,
    });
  });

  it("when the entitlement is ahead of the subscription mirror, shows the plan without inventing dates", () => {
    expect(describePlan(entitlement(), [], NOW)).toEqual({
      plan: "plus",
      source: "paid",
      interval: null,
      priceCents: null,
      next: { kind: "none" },
    });
  });
});

describe("sourceOf", () => {
  it("maps Stripe to paid and keeps trial and comp", () => {
    expect(sourceOf(FREE)).toBe("free");
    expect(sourceOf(entitlement())).toBe("paid");
    expect(sourceOf(entitlement({ source: "trial" }))).toBe("trial");
    expect(sourceOf(entitlement({ source: "comp" }))).toBe("comp");
  });
});

describe("isLive", () => {
  it.each(["trialing", "active", "past_due"] as const)("%s is still billed", (status) => {
    expect(isLive({ status })).toBe(true);
  });
  it.each(["canceled", "incomplete", "incomplete_expired", "unpaid", "paused"] as const)(
    "%s is not, so a new checkout is allowed",
    (status) => {
      expect(isLive({ status })).toBe(false);
    },
  );
});

describe("yearlySavingsPercent", () => {
  it("rounds down so the saving is never overstated", () => {
    // 35.99 vs 12 × 3.99 = 47.88 → 24.8 % → 24 %.
    expect(yearlySavingsPercent({ month: 399, year: 3599 })).toBe(24);
    expect(yearlySavingsPercent({ month: 1000, year: 12000 })).toBe(0);
  });
});
