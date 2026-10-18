import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";
import { deliver, fakeStripe, stripeHandlers, stripeSubscription } from "./support/stripe";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const { getBillingStatus, getPricing } = await import("@/server/features/billing/queries");
const billing = await import("@/server/actions/billing");
const tries = await import("@/server/quota/tries");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeStripe.reset();
  hibp.use(...stripeHandlers);
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function signedInUser(email = "amina@example.com") {
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

/** Spends `count` tries of a feature the way a metered action would. */
async function spend(userId: string, feature: "assistant" | "voice", count: number) {
  for (let i = 0; i < count; i++) {
    const reserved = await tries.reserve(userId, feature);
    if (!reserved.ok) throw new Error(reserved.reason);
    await tries.commit(reserved.reservation);
  }
}

describe("getBillingStatus (Settings → Plan & billing)", () => {
  it("is null without a session", async () => {
    expect(await getBillingStatus()).toBeNull();
  });

  it("Free: no dates, trial still available, no portal, and tries from the counters", async () => {
    const userId = await signedInUser();
    await spend(userId, "assistant", 3);
    const status = await getBillingStatus();
    expect(status).toMatchObject({
      plan: "free",
      source: "free",
      priceCents: null,
      next: { kind: "none" },
      canManageBilling: false,
      trialAvailable: true,
    });
    expect(status?.usage.map((u) => u.feature)).toEqual(["assistant", "voice", "import", "spins"]);
    expect(status?.usage[0]).toMatchObject({ feature: "assistant", limit: 10, remaining: 7, period: "month" });
    // Free resets on the 1st of next month (UTC).
    const resetsAt = new Date(status!.usage[0]!.resetsAt!);
    expect(resetsAt.getUTCDate()).toBe(1);
    expect(resetsAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("only ever describes the caller's own plan", async () => {
    const other = await signedInUser("karim@example.com");
    await deliver(
      "customer.subscription.created",
      stripeSubscription({ userId: other, plan: "pro", status: "active" }),
    );
    browser.reset();
    await signedInUser("amina@example.com");
    expect((await getBillingStatus())?.plan).toBe("free");
  });

  it("checkout success: Free until the webhook lands, then the trial with its end date", async () => {
    const userId = await signedInUser();
    await billing.startCheckout({ plan: "plus", interval: "month", locale: "en" });
    // Back from Stripe before the webhook: still Free, so the page says "Finishing up".
    expect(await getBillingStatus()).toMatchObject({ plan: "free", canManageBilling: true });

    const sub = stripeSubscription({ userId, trialDays: 7 });
    await deliver("customer.subscription.created", sub);
    const status = await getBillingStatus();
    expect(status).toMatchObject({
      plan: "plus",
      source: "trial",
      interval: "month",
      priceCents: 399,
      next: { kind: "trial_converts", at: new Date(sub.trial_end! * 1000).toISOString() },
      trialAvailable: false,
    });
    // Plus allowances apply straight away.
    expect(status?.usage[0]).toMatchObject({ limit: 150, remaining: 150 });
  });

  it("paid → cancelled at period end → grace after a failed payment", async () => {
    const userId = await signedInUser();
    const sub = stripeSubscription({ userId, status: "active", plan: "pro", interval: "year" });
    await deliver("customer.subscription.created", sub);
    const periodEnd = new Date(sub.items.data[0]!.current_period_end * 1000).toISOString();
    expect(await getBillingStatus()).toMatchObject({
      plan: "pro",
      source: "paid",
      priceCents: 6999,
      next: { kind: "renews", at: periodEnd },
    });

    await deliver(
      "customer.subscription.updated",
      stripeSubscription({ userId, status: "active", plan: "pro", interval: "year", cancelAtPeriodEnd: true }),
    );
    expect((await getBillingStatus())?.next).toEqual({ kind: "ends", at: periodEnd });

    stripeSubscription({ userId, status: "past_due", plan: "pro", interval: "year" });
    await deliver("invoice.payment_failed", {
      id: "in_1",
      object: "invoice",
      amount_paid: 0,
      parent: { type: "subscription_details", subscription_details: { subscription: sub.id } },
    });
    const next = (await getBillingStatus())?.next;
    expect(next?.kind).toBe("grace");
    const graceEnd = new Date(next && "at" in next ? next.at : 0).getTime();
    expect(Math.abs(graceEnd - (Date.now() + 7 * DAY_MS))).toBeLessThan(60_000);
  });

  it("a comp: a gift with no price", async () => {
    const userId = await signedInUser();
    await db()
      .insert(schema.entitlements)
      .values({ userId, plan: "pro", source: "comp", periodStart: new Date(), periodEnd: null });
    expect(await getBillingStatus()).toMatchObject({
      plan: "pro",
      source: "comp",
      priceCents: null,
      next: { kind: "none" },
    });
  });
});

describe("getPricing", () => {
  it("reads every limit from plan_limits, so a seed change shows up without a deploy", async () => {
    const where = and(eq(schema.planLimits.plan, "plus"), eq(schema.planLimits.feature, "assistant"));
    await db().update(schema.planLimits).set({ limit: 175 }).where(where);
    try {
      const { plans, viewer } = await getPricing();
      expect(viewer).toEqual({ signedIn: false });
      const plus = plans.find((p) => p.plan === "plus");
      expect(plus?.limits.find((l) => l.feature === "assistant")).toEqual({
        feature: "assistant",
        limit: 175,
        period: "month",
      });
      expect(plus?.prices).toEqual({ month: 399, year: 3599 });
      expect(plans.map((p) => p.plan)).toEqual(["free", "plus", "pro"]);
      expect(plans[0]?.prices).toBeNull();
      // Every plan lists every feature.
      expect(new Set(plans.map((p) => p.limits.length))).toEqual(new Set([12]));
    } finally {
      await db().update(schema.planLimits).set({ limit: 150 }).where(where);
    }
  });

  it("tells a signed-in viewer whether the trial is still theirs and whether they already pay", async () => {
    const userId = await signedInUser();
    expect((await getPricing()).viewer).toEqual({
      signedIn: true,
      plan: "free",
      source: "free",
      subscribed: false,
      trialAvailable: true,
    });
    await deliver("customer.subscription.created", stripeSubscription({ userId, trialDays: 7 }));
    expect((await getPricing()).viewer).toMatchObject({
      plan: "plus",
      source: "trial",
      subscribed: true,
      trialAvailable: false,
    });

    // Cancelled for good: no longer subscribed, and the trial stays spent.
    await deliver("customer.subscription.deleted", stripeSubscription({ userId, status: "canceled", trialDays: 7 }));
    expect((await getPricing()).viewer).toMatchObject({ plan: "free", subscribed: false, trialAvailable: false });
  });
});

describe("getUpgradeOffer", () => {
  it("requires a session", async () => {
    expect(await billing.getUpgradeOffer({ feature: "assistant" })).toEqual({ serverError: "unauthorized" });
  });

  it("rejects features that don't exist", async () => {
    await signedInUser();
    // @ts-expect-error: not a plan feature.
    expect((await billing.getUpgradeOffer({ feature: "unlimited_everything" })).validationErrors).toBeDefined();
  });

  it("out of Assistant tries on Free: what ran out, when it resets, and both higher plans", async () => {
    const userId = await signedInUser();
    await spend(userId, "assistant", 10);
    expect((await tries.reserve(userId, "assistant")).ok).toBe(false);

    const { data } = await billing.getUpgradeOffer({ feature: "assistant" });
    expect(data).toMatchObject({
      feature: "assistant",
      plan: "free",
      current: { limit: 10, period: "month" },
      usage: { limit: 10, remaining: 0 },
      trialAvailable: true,
      subscribed: false,
    });
    expect(data?.usage?.resetsAt).toEqual(expect.any(String));
    expect(data?.options).toEqual([
      {
        plan: "plus",
        prices: { month: 399, year: 3599 },
        limit: { feature: "assistant", limit: 150, period: "month" },
      },
      { plan: "pro", prices: { month: 799, year: 6999 }, limit: { feature: "assistant", limit: 600, period: "month" } },
    ]);
  });

  it("a gated feature on Plus: only Pro is offered, and changes go through the portal", async () => {
    const userId = await signedInUser();
    await deliver("customer.subscription.created", stripeSubscription({ userId, status: "active" }));
    const { data } = await billing.getUpgradeOffer({ feature: "household_list" });
    expect(data).toMatchObject({ plan: "plus", current: { limit: 0 }, usage: null, subscribed: true });
    expect(data?.options.map((o) => o.plan)).toEqual(["pro"]);
  });

  it("on Pro there is nothing higher to sell", async () => {
    const userId = await signedInUser();
    await deliver("customer.subscription.created", stripeSubscription({ userId, status: "active", plan: "pro" }));
    expect((await billing.getUpgradeOffer({ feature: "voice" })).data?.options).toEqual([]);
  });
});
