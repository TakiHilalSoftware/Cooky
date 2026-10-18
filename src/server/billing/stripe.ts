import "server-only";

import Stripe from "stripe";

import { env } from "@/server/env";

let client: Stripe | undefined;

/** Server-only Stripe client (no Stripe JS in the browser: ARCHITECTURE §1). */
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set (docs/SETUP_KEYS.md §4).");
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 10_000, appInfo: { name: "Cooky" } });
  return client;
}

export type { Stripe };
