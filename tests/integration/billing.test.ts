import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { auditActions, db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";
import { deliver, fakeStripe, invoiceFor, stripeHandlers, stripeSubscription } from "./support/stripe";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const { getEntitlement } = await import("@/server/quota/entitlement");
const { reconcileBilling } = await import("@/server/billing/reconcile");
const { drainOutbox } = await import("@/server/outbox/drain");
const billing = await import("@/server/actions/billing");
const { POST: cron } = await import("@/app/api/cron/[job]/route");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeStripe.reset();
  hibp.use(...stripeHandlers);
  sendEmail.mockClear();
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function newUser(email = "amina@example.com") {
  await signUpAndVerify(email);
  return (await userByEmail(email))!.id;
}

/** Subjects of every email sent so far, after the outbox has run. */
async function sentSubjects(): Promise<string[]> {
  await drainOutbox({ limit: 50 });
  return (sendEmail.mock.calls as unknown as [string, { subject: string }][]).map(([, email]) => email.subject);
}

/** The webhook also drains in the background, so wait for the send rather than racing it. */
async function expectEmail(subject: string, times = 1) {
  await vi.waitFor(async () => {
    expect((await sentSubjects()).filter((s) => s === subject)).toHaveLength(times);
  });
}

async function subscriptionRow(id = "sub_1") {
  const [row] = await db().select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id));
  return row;
}

describe("Stripe webhook", () => {
  it("rejects a payload that isn't signed with our secret, and changes nothing", async () => {
    const userId = await newUser();
    const sub = stripeSubscription({ userId, trialDays: 7 });
    const forged = await deliver("customer.subscription.created", sub, { secret: "whsec_attacker" });
    expect(forged.status).toBe(400);
    expect((await getEntitlement(userId)).plan).toBe("free");
    expect(await db().select().from(schema.stripeEvents)).toHaveLength(0);
  });

  it("starts a trial: Plus from now, recorded so it can't be used twice", async () => {
    const userId = await newUser();
    const sub = stripeSubscription({ userId, trialDays: 7 });
    expect(await deliver("customer.subscription.created", sub)).toEqual({
      status: 200,
      body: { received: true, outcome: "processed" },
    });

    expect((await getEntitlement(userId)).plan).toBe("plus");
    const [entitlement] = await db().select().from(schema.entitlements).where(eq(schema.entitlements.userId, userId));
    expect(entitlement?.source).toBe("trial");
    expect(await db().select().from(schema.trialRedemptions)).toEqual([
      expect.objectContaining({ userId, plan: "plus" }),
    ]);
    expect(await auditActions(userId)).toContain("billing.plan_changed");
  });

  it("applies a replayed event only once", async () => {
    const userId = await newUser();
    const sub = stripeSubscription({ userId, status: "active", plan: "pro" });
    const first = await deliver("customer.subscription.created", sub, { id: "evt_same" });
    const replay = await deliver("customer.subscription.created", sub, { id: "evt_same" });
    expect([first.body.outcome, replay.body.outcome]).toEqual(["processed", "duplicate"]);
    expect((await auditActions(userId)).filter((a) => a === "billing.plan_changed")).toHaveLength(1);
  });

  it("trusts Stripe's current state over the event's copy", async () => {
    const userId = await newUser();
    const stale = stripeSubscription({ userId, status: "active", plan: "plus" });
    // Stripe already moved on to Pro by the time the old event arrives.
    stripeSubscription({ userId, status: "active", plan: "pro" });
    await deliver("customer.subscription.updated", stale);
    expect((await getEntitlement(userId)).plan).toBe("pro");
  });

  it("acknowledges events it doesn't act on", async () => {
    expect((await deliver("customer.created", { id: "cus_9", object: "customer" })).body.outcome).toBe("ignored");
  });

  it("keeps the plan for 7 days after a failed payment, then moves to Free", async () => {
    const userId = await newUser();
    stripeSubscription({ userId, status: "past_due" });
    await deliver("invoice.payment_failed", invoiceFor("sub_1"));
    const firstFailure = (await subscriptionRow())!.paymentFailedAt!;
    // A retry failing again doesn't restart the grace period.
    await deliver("invoice.payment_failed", invoiceFor("sub_1"));
    expect((await subscriptionRow())!.paymentFailedAt).toEqual(firstFailure);
    expect((await getEntitlement(userId)).plan).toBe("plus");

    const sixDaysLater = new Date(firstFailure.getTime() + 6 * DAY_MS);
    await reconcileBilling(sixDaysLater);
    expect((await getEntitlement(userId, sixDaysLater)).plan).toBe("plus");

    const eightDaysLater = new Date(firstFailure.getTime() + 8 * DAY_MS);
    await reconcileBilling(eightDaysLater);
    expect((await getEntitlement(userId, eightDaysLater)).plan).toBe("free");
    await expectEmail("Your Cooky payment didn't go through", 2);
  });

  it("finds a subscription nightly even when none of its webhooks arrived", async () => {
    const userId = await newUser();
    await db().insert(schema.billingCustomers).values({ userId, stripeCustomerId: "cus_1" });
    stripeSubscription({ userId, status: "active", plan: "pro" });
    expect((await getEntitlement(userId)).plan).toBe("free");

    expect(await reconcileBilling()).toEqual({ synced: 1, changed: 1 });
    expect((await getEntitlement(userId)).plan).toBe("pro");
  });

  it("ends the grace period when the payment goes through, and sends a receipt", async () => {
    const userId = await newUser();
    stripeSubscription({ userId, status: "past_due" });
    await deliver("invoice.payment_failed", invoiceFor("sub_1"));
    stripeSubscription({ userId, status: "active" });
    await deliver("invoice.paid", invoiceFor("sub_1"));
    expect((await subscriptionRow())!.paymentFailedAt).toBeNull();
    await expectEmail("Your Cooky receipt");
  });

  it("sends no receipt for a €0 invoice (a trial's first invoice)", async () => {
    const userId = await newUser();
    stripeSubscription({ userId, trialDays: 7 });
    await deliver("invoice.paid", invoiceFor("sub_1", 0));
    expect(await sentSubjects()).not.toContain("Your Cooky receipt");
  });

  it("confirms a cancellation once, keeps the plan until the period ends, then Free", async () => {
    const userId = await newUser();
    await deliver("customer.subscription.created", stripeSubscription({ userId, status: "active" }));
    const cancelling = stripeSubscription({ userId, status: "active", cancelAtPeriodEnd: true });
    await deliver("customer.subscription.updated", cancelling);
    await deliver("customer.subscription.updated", cancelling);
    expect((await getEntitlement(userId)).plan).toBe("plus");
    await expectEmail("Your Cooky plan is cancelled");

    await deliver("customer.subscription.deleted", stripeSubscription({ userId, status: "canceled" }));
    expect((await getEntitlement(userId)).plan).toBe("free");
  });

  it("warns before a trial ends", async () => {
    const userId = await newUser();
    await deliver("customer.subscription.trial_will_end", stripeSubscription({ userId, trialDays: 7 }));
    await expectEmail("Your Cooky trial ends in 3 days");
  });

  it("never downgrades an admin comp that's still running", async () => {
    const userId = await newUser();
    await db()
      .insert(schema.entitlements)
      .values({
        userId,
        plan: "pro",
        source: "comp",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * DAY_MS),
      });
    await deliver("customer.subscription.deleted", stripeSubscription({ userId, status: "canceled" }));
    expect((await getEntitlement(userId)).plan).toBe("pro");
  });

  it("returns 500 so Stripe retries when processing fails, and keeps nothing", async () => {
    const userId = await newUser();
    const sub = stripeSubscription({ userId });
    fakeStripe.subscriptions.clear(); // Stripe can't hand over the fresh copy.
    expect((await deliver("customer.subscription.created", sub)).status).toBe(500);
    expect(await db().select().from(schema.stripeEvents)).toHaveLength(0);
  });
});

describe("startCheckout", () => {
  const checkout = { plan: "plus", interval: "month", locale: "fr" } as const;

  it("requires a session", async () => {
    expect(await billing.startCheckout(checkout)).toEqual({ serverError: "unauthorized" });
  });

  it("includes the 7-day trial the first time only, and reuses the Stripe customer", async () => {
    const userId = await newUser();
    await logIn();
    expect(await billing.startCheckout(checkout)).toEqual({
      data: { status: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_1", trial: true },
    });
    const [first] = fakeStripe.checkouts;
    expect(first?.get("subscription_data[trial_period_days]")).toBe("7");
    expect(first?.get("subscription_data[metadata][userId]")).toBe(userId);
    expect(first?.get("line_items[0][price]")).toBe("price_cooky_plus_month");
    expect(first?.get("success_url")).toBe("http://localhost:3000/fr/settings/billing?checkout=success");
    expect(first?.has("automatic_tax[enabled]")).toBe(false);

    await db().insert(schema.trialRedemptions).values({ userId, plan: "plus" });
    expect((await billing.startCheckout({ ...checkout, plan: "pro" })).data).toMatchObject({ trial: false });
    expect(fakeStripe.checkouts[1]?.has("subscription_data[trial_period_days]")).toBe(false);
    expect(fakeStripe.customersCreated).toBe(1);
  });

  it("sends people who already pay to the portal instead of a second subscription", async () => {
    const userId = await newUser();
    await logIn();
    await deliver("customer.subscription.created", stripeSubscription({ userId, status: "active" }));
    expect(await billing.startCheckout(checkout)).toEqual({ data: { status: "already_subscribed" } });
    expect(fakeStripe.checkouts).toHaveLength(0);
  });

  it("asks Stripe before selling: a subscription whose webhooks never arrived blocks a second one", async () => {
    const userId = await newUser();
    await logIn();
    await db().insert(schema.billingCustomers).values({ userId, stripeCustomerId: "cus_1" });
    // Paid in Stripe, but the listener was down: the mirror still says Free.
    stripeSubscription({ userId, trialDays: 7 });

    expect(await billing.startCheckout(checkout)).toEqual({ data: { status: "already_subscribed" } });
    expect(fakeStripe.checkouts).toHaveLength(0);
    // The mirror caught up on the way: plan, trial and all.
    expect((await subscriptionRow())?.status).toBe("trialing");
    expect((await getEntitlement(userId)).plan).toBe("plus");
    expect(await db().select().from(schema.trialRedemptions)).toHaveLength(1);
  });

  it("gives no second trial when Stripe remembers an ended one the mirror missed", async () => {
    const userId = await newUser();
    await logIn();
    await db().insert(schema.billingCustomers).values({ userId, stripeCustomerId: "cus_1" });
    stripeSubscription({ userId, trialDays: 7, status: "canceled" });

    expect((await billing.startCheckout(checkout)).data).toMatchObject({ status: "redirect", trial: false });
    expect(fakeStripe.checkouts[0]?.has("subscription_data[trial_period_days]")).toBe(false);
  });

  it("says plans are unavailable when Stripe has no price for them", async () => {
    await newUser();
    await logIn();
    fakeStripe.prices.clear();
    expect(await billing.startCheckout(checkout)).toEqual({ serverError: "unavailable" });
  });

  it("rejects a plan that isn't sold", async () => {
    await newUser();
    await logIn();
    // @ts-expect-error: Free can't be bought.
    expect((await billing.startCheckout({ ...checkout, plan: "free" })).validationErrors).toBeDefined();
    expect(fakeStripe.checkouts).toHaveLength(0);
  });
});

describe("openBillingPortal", () => {
  it("opens the portal for the person's own customer only", async () => {
    await newUser();
    await logIn();
    expect(await billing.openBillingPortal({ locale: "en" })).toEqual({ serverError: "not_found" });
    await billing.startCheckout({ plan: "plus", interval: "year", locale: "en" });
    expect(await billing.openBillingPortal({ locale: "en" })).toEqual({
      data: { url: "https://billing.stripe.com/p/session/bps_1" },
    });
    expect(fakeStripe.portals[0]?.get("customer")).toBe("cus_1");
    expect(fakeStripe.portals[0]?.get("return_url")).toBe("http://localhost:3000/en/settings/billing");
  });
});

describe("cron jobs", () => {
  const call = (job: string, token?: string) =>
    cron(
      new Request(`http://localhost:3000/api/cron/${job}`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
      { params: Promise.resolve({ job }) },
    );

  it("refuses callers without the cron secret", async () => {
    expect((await call("billing-reconcile")).status).toBe(401);
    expect((await call("billing-reconcile", "guess")).status).toBe(401);
  });

  it("fixes a plan whose webhook never arrived, and 404s unknown jobs", async () => {
    const userId = await newUser();
    await deliver("customer.subscription.created", stripeSubscription({ userId, status: "active" }));
    // Stripe cancelled it, but the webhook was lost.
    stripeSubscription({ userId, status: "canceled" });
    const response = await call("billing-reconcile", "integration-cron-secret-0123456789abcdef");
    expect(await response.json()).toEqual({ synced: 1, changed: 1 });
    expect((await getEntitlement(userId)).plan).toBe("free");
    expect((await call("nope", "integration-cron-secret-0123456789abcdef")).status).toBe(404);
  });
});
