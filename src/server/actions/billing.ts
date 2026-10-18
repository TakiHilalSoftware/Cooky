"use server";

import { and, eq, inArray } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { z } from "zod";

import { INTERVALS, PAID_PLANS, stripeLookupKey, TRIAL_DAYS } from "@config/plans";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { routing } from "@/i18n/routing";
import type { ActionErrorCode } from "@/lib/errors";
import { getStripe } from "@/server/billing/stripe";
import { getDb } from "@/server/db/client";
import { billingCustomers, subscriptions, trialRedemptions } from "@/server/db/schema";
import { env } from "@/server/env";
import type { CheckoutResult, PortalResult, UpgradeOfferDto } from "@/server/features/billing/dto";
import { getUpgradeOffer as loadUpgradeOffer } from "@/server/features/billing/queries";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/server/features/billing/service";

import { userAction } from "./_clients";

const checkoutSchema = z.object({
  plan: z.enum(PAID_PLANS),
  interval: z.enum(INTERVALS),
  locale: z.enum(routing.locales),
});

/** The person's Stripe customer, created once and reused (never per checkout). */
async function stripeCustomerFor(user: { id: string; email: string; name: string }): Promise<string> {
  const db = getDb();
  const [existing] = await db
    .select({ id: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, user.id))
    .limit(1);
  if (existing) return existing.id;

  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name, metadata: { userId: user.id } },
    // A double click can't create two customers.
    { idempotencyKey: `customer-${user.id}` },
  );
  await db.insert(billingCustomers).values({ userId: user.id, stripeCustomerId: customer.id }).onConflictDoNothing();
  const [row] = await db
    .select({ id: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, user.id))
    .limit(1);
  return row!.id;
}

/**
 * Starts Stripe Checkout for a plan (ARCHITECTURE §5.3). Includes the 7-day
 * trial only if this account never had one. People who already pay manage
 * their plan in the Customer Portal instead.
 */
export const startCheckout = userAction
  .metadata({ actionName: "startCheckout" })
  .inputSchema(checkoutSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<CheckoutResult> => {
    const db = getDb();
    const [active] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, ctx.user.id), inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])))
      .limit(1);
    if (active) return { status: "already_subscribed" };

    const stripe = getStripe();
    const [price] = (
      await stripe.prices.list({ lookup_keys: [stripeLookupKey(input.plan, input.interval)], active: true })
    ).data;
    // Prices come from `pnpm stripe:sync`; without them nothing can be sold.
    if (!price) returnServerError<ActionErrorCode>("unavailable");

    const [trialUsed] = await db
      .select({ userId: trialRedemptions.userId })
      .from(trialRedemptions)
      .where(eq(trialRedemptions.userId, ctx.user.id))
      .limit(1);
    const customer = await stripeCustomerFor(ctx.user);
    const tax = env.STRIPE_AUTOMATIC_TAX === "on";
    const base = `${env.NEXT_PUBLIC_APP_URL}/${input.locale}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: ctx.user.id,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: {
        metadata: { userId: ctx.user.id },
        ...(trialUsed ? {} : { trial_period_days: TRIAL_DAYS }),
      },
      // The success page reads the plan from the database, never from this URL (ARCHITECTURE §5.3).
      success_url: `${base}/settings/billing?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      locale: input.locale === "ar" ? "auto" : input.locale,
      ...(tax ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" as const } } : {}),
    });
    if (!session.url) returnServerError<ActionErrorCode>("unavailable");
    return { status: "redirect", url: session.url, trial: !trialUsed };
  });

const portalSchema = z.object({ locale: z.enum(routing.locales) });

/** Stripe Customer Portal: change plan, card, cancel, invoices. */
export const openBillingPortal = userAction
  .metadata({ actionName: "openBillingPortal" })
  .inputSchema(portalSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<PortalResult> => {
    const [customer] = await getDb()
      .select({ id: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, ctx.user.id))
      .limit(1);
    if (!customer) returnServerError<ActionErrorCode>("not_found");
    const session = await getStripe().billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/${input.locale}/settings/billing`,
    });
    return { url: session.url };
  });

const upgradeOfferSchema = z.object({ feature: z.enum(PLAN_FEATURES) });

/**
 * What the upgrade sheet explains after `quota_exceeded` / `plan_required`:
 * what ran out, when it resets, and what the higher plans give. Read-only,
 * from the server, so the sheet never guesses a limit.
 */
export const getUpgradeOffer = userAction
  .metadata({ actionName: "getUpgradeOffer" })
  .inputSchema(upgradeOfferSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<UpgradeOfferDto> =>
    loadUpgradeOffer(ctx.user.id, input.feature),
  );
