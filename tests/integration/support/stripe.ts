import { http, HttpResponse } from "msw";
import Stripe from "stripe";

import { POST as webhook } from "@/app/api/webhooks/stripe/route";

const API = "https://api.stripe.com/v1";
const DAY = 24 * 60 * 60;

/**
 * A tiny in-memory Stripe: just the endpoints Cooky calls. Tests set the
 * subscriptions Stripe "has", and read back what Cooky asked Stripe to do.
 */
export const fakeStripe = {
  subscriptions: new Map<string, Record<string, unknown>>(),
  prices: new Set(["cooky_plus_month", "cooky_plus_year", "cooky_pro_month", "cooky_pro_year"]),
  customersCreated: 0,
  checkouts: [] as URLSearchParams[],
  portals: [] as URLSearchParams[],
  customersDeleted: [] as string[],
  subscriptionsCancelled: [] as string[],
  reset() {
    this.customersDeleted = [];
    this.subscriptionsCancelled = [];
    this.subscriptions.clear();
    this.prices = new Set(["cooky_plus_month", "cooky_plus_year", "cooky_pro_month", "cooky_pro_year"]);
    this.customersCreated = 0;
    this.checkouts = [];
    this.portals = [];
  },
};

const form = async (request: Request) => new URLSearchParams(await request.text());

export const stripeHandlers = [
  http.get(`${API}/subscriptions`, ({ request }) => {
    const customer = new URL(request.url).searchParams.get("customer");
    const data = [...fakeStripe.subscriptions.values()].filter((sub) => sub.customer === customer);
    return HttpResponse.json({ object: "list", data, has_more: false, url: "/v1/subscriptions" });
  }),
  http.get(`${API}/subscriptions/:id`, ({ params }) => {
    const sub = fakeStripe.subscriptions.get(String(params.id));
    return sub
      ? HttpResponse.json(sub)
      : HttpResponse.json(
          { error: { type: "invalid_request_error", message: "No such subscription" } },
          { status: 404 },
        );
  }),
  http.post(`${API}/customers`, () => {
    fakeStripe.customersCreated++;
    return HttpResponse.json({ id: `cus_${fakeStripe.customersCreated}`, object: "customer" });
  }),
  http.get(`${API}/prices`, ({ request }) => {
    const lookupKey = new URL(request.url).searchParams.get("lookup_keys[0]") ?? "";
    const data = fakeStripe.prices.has(lookupKey)
      ? [{ id: `price_${lookupKey}`, object: "price", lookup_key: lookupKey }]
      : [];
    return HttpResponse.json({ object: "list", data, has_more: false, url: "/v1/prices" });
  }),
  http.delete(`${API}/customers/:id`, ({ params }) => {
    fakeStripe.customersDeleted.push(String(params.id));
    return HttpResponse.json({ id: params.id, object: "customer", deleted: true });
  }),
  http.delete(`${API}/subscriptions/:id`, ({ params }) => {
    fakeStripe.subscriptionsCancelled.push(String(params.id));
    const sub = fakeStripe.subscriptions.get(String(params.id)) ?? { id: params.id, object: "subscription" };
    return HttpResponse.json({ ...sub, status: "canceled" });
  }),
  http.post(`${API}/checkout/sessions`, async ({ request }) => {
    fakeStripe.checkouts.push(await form(request));
    return HttpResponse.json({
      id: "cs_test_1",
      object: "checkout.session",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
  }),
  http.post(`${API}/billing_portal/sessions`, async ({ request }) => {
    fakeStripe.portals.push(await form(request));
    return HttpResponse.json({
      id: "bps_1",
      object: "billing_portal.session",
      url: "https://billing.stripe.com/p/session/bps_1",
    });
  }),
];

type SubscriptionOptions = {
  id?: string;
  userId: string;
  status?: string;
  plan?: "plus" | "pro";
  interval?: "month" | "year";
  start?: Date;
  trialDays?: number;
  cancelAtPeriodEnd?: boolean;
};

/** Puts a subscription into the fake Stripe and returns it. */
export function stripeSubscription(options: SubscriptionOptions) {
  const start = Math.floor((options.start ?? new Date()).getTime() / 1000);
  const end = start + (options.trialDays ? options.trialDays * DAY : (options.interval === "year" ? 365 : 30) * DAY);
  const sub = {
    id: options.id ?? "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: options.status ?? (options.trialDays ? "trialing" : "active"),
    metadata: { userId: options.userId },
    cancel_at_period_end: options.cancelAtPeriodEnd ?? false,
    trial_end: options.trialDays ? end : null,
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          price: {
            id: "price_x",
            object: "price",
            lookup_key: `cooky_${options.plan ?? "plus"}_${options.interval ?? "month"}`,
          },
          current_period_start: start,
          current_period_end: end,
        },
      ],
    },
  };
  fakeStripe.subscriptions.set(sub.id, sub);
  return sub;
}

export function invoiceFor(subscriptionId: string, amountPaid = 399) {
  return {
    id: "in_1",
    object: "invoice",
    amount_paid: amountPaid,
    hosted_invoice_url: "https://invoice.stripe.com/i/in_1",
    parent: { type: "subscription_details", subscription_details: { subscription: subscriptionId } },
  };
}

let eventCounter = 0;
const signer = new Stripe("sk_test_integration");

/** Delivers an event to the webhook route exactly as Stripe would: signed raw JSON. */
export async function deliver(type: string, object: object, options: { id?: string; secret?: string } = {}) {
  const payload = JSON.stringify({
    id: options.id ?? `evt_${++eventCounter}`,
    object: "event",
    type,
    api_version: "2026-09-30.endive",
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret: options.secret ?? "whsec_integration",
  });
  const response = await webhook(
    new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    }),
  );
  return { status: response.status, body: (await response.json()) as { outcome?: string } };
}
