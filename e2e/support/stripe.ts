import { expect } from "@playwright/test";
import pg from "pg";
import Stripe from "stripe";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

/**
 * Real Stripe test mode for the billing journeys. Stripe's API stands in for
 * the customer (subscribe, pay, fail, cancel) on test clocks, so trials and
 * renewals happen in seconds; the events Stripe generates are then signed
 * with our webhook secret and delivered to the server under test, which
 * re-reads Stripe exactly as in production (ARCHITECTURE §5.3).
 */
export const stripeConfigured = /^sk_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_missing");
const DAY = 24 * 60 * 60;

/** The E2E server's database (the same fresh cooky_test the specs start from). */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

export async function userIdOf(email: string): Promise<string> {
  const [row] = await sql<{ id: string }>(`select id from "user" where email = $1`, [email]);
  return row!.id;
}

async function priceId(lookupKey: string): Promise<string> {
  const [price] = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true })).data;
  if (!price) throw new Error(`No Stripe price ${lookupKey}; run pnpm stripe:sync`);
  return price.id;
}

/** A customer on its own test clock, with a working card, linked to the Cooky account. */
export async function clockCustomer(userId: string, email: string) {
  const now = Math.floor(Date.now() / 1000);
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: now, name: `cooky-e2e ${email}` });
  const customer = await stripe.customers.create({
    email,
    test_clock: clock.id,
    payment_method: "pm_card_visa",
    metadata: { userId },
  });
  const [card] = (await stripe.paymentMethods.list({ customer: customer.id })).data;
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: card!.id } });
  // The portal and the success page look the customer up through this row.
  await sql(
    `insert into billing_customers (user_id, stripe_customer_id) values ($1, $2)
     on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id`,
    [userId, customer.id],
  );

  let frozen = now;
  return {
    customerId: customer.id,
    subscribe: (lookupKey: string, options: { trialDays?: number } = {}) =>
      priceId(lookupKey).then((price) =>
        stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price }],
          metadata: { userId },
          ...(options.trialDays ? { trial_period_days: options.trialDays } : {}),
        }),
      ),
    /** Moves the clock forward and waits until Stripe has run everything that was due. */
    async advance(days: number) {
      frozen += Math.round(days * DAY);
      await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: frozen });
      await expect
        .poll(async () => (await stripe.testHelpers.testClocks.retrieve(clock.id)).status, {
          timeout: 120_000,
          intervals: [2_000],
        })
        .toBe("ready");
    },
    /** From now on every charge fails (Stripe's "declined after attaching" test card). */
    async useFailingCard() {
      const failing = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customer.id });
      await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: failing.id } });
    },
    /** Deleting the clock deletes its customer and subscriptions too. */
    cleanup: () => stripe.testHelpers.testClocks.del(clock.id),
  };
}

export const changePlan = async (subscriptionId: string, lookupKey: string) => {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: sub.items.data[0]!.id, price: await priceId(lookupKey) }],
    proration_behavior: "none",
  });
};
export const cancelAtPeriodEnd = (subscriptionId: string) =>
  stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
export const cancelNow = (subscriptionId: string) => stripe.subscriptions.cancel(subscriptionId);

/** Customers made by real Checkout sessions in a test (not on a clock). */
export async function deleteCustomerOf(userId: string) {
  const rows = await sql<{ id: string }>(`select stripe_customer_id as id from billing_customers where user_id = $1`, [
    userId,
  ]);
  for (const { id } of rows) await stripe.customers.del(id).catch(() => undefined);
}

function subscriptionOf(object: Record<string, unknown>): string | null {
  if (object.object === "subscription") return object.id as string;
  const parent = object.parent as { subscription_details?: { subscription?: string } } | undefined;
  return parent?.subscription_details?.subscription ?? null;
}

const delivered = new Set<string>();

/**
 * Finds the newest event Stripe generated for this subscription that we
 * haven't delivered yet, and delivers it to the webhook route, signed exactly
 * as Stripe signs it. Waiting for an undelivered one means a slow event list
 * can't make us replay the previous update (a no-op duplicate).
 */
export async function deliverStripeEvent(baseURL: string, type: string, subscriptionId: string) {
  let event: Stripe.Event | undefined;
  await expect
    .poll(
      async () => {
        const { data } = await stripe.events.list({ type, limit: 100 });
        event = data.find(
          (e) =>
            !delivered.has(e.id) &&
            subscriptionOf(e.data.object as unknown as Record<string, unknown>) === subscriptionId,
        );
        return Boolean(event);
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 3_000], message: `Stripe event ${type} for ${subscriptionId}` },
    )
    .toBe(true);

  delivered.add(event!.id);
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  const response = await fetch(`${baseURL}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
  expect(response.status, `webhook ${type}`).toBe(200);
  return (await response.json()) as { outcome?: string };
}

/** The nightly reconcile, called the way the scheduler calls it. */
export async function runReconcile(baseURL: string) {
  const response = await fetch(`${baseURL}/api/cron/billing-reconcile`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { synced: number; changed: number };
}
