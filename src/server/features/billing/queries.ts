import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { PAID_PLANS, PLAN_RANK, PLANS, type Plan } from "@config/plans";
import { isMeteredFeature, METERED_FEATURES, PLAN_FEATURES, type PlanFeature } from "@/lib/plan-features";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { billingCustomers, planLimits, subscriptions, trialRedemptions } from "@/server/db/schema";
import { getEntitlement } from "@/server/quota/entitlement";
import { usageFor } from "@/server/quota/tries";

import type { BillingStatusDto, FeatureLimitDto, PricingDto, PricingViewerDto, UpgradeOfferDto, UsageDto } from "./dto";
import { describePlan, isLive, pricesOf, sourceOf, toUsageDto, yearlySavingsPercent } from "./service";

/** The person's billing records: subscriptions, whether a Stripe customer exists, and whether the trial is spent. */
async function loadBillingRecords(userId: string) {
  const db = getDb();
  const [subs, [customer], [trial]] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db
      .select({ id: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1),
    db
      .select({ userId: trialRedemptions.userId })
      .from(trialRedemptions)
      .where(eq(trialRedemptions.userId, userId))
      .limit(1),
  ]);
  return { subs, hasCustomer: Boolean(customer), trialAvailable: !trial, subscribed: subs.some(isLive) };
}

/** Every plan × feature allowance, from `plan_limits` only (AGENT_RULES §4). */
async function loadLimitTable(): Promise<Record<Plan, FeatureLimitDto[]>> {
  const rows = await getDb()
    .select({ plan: planLimits.plan, feature: planLimits.feature, limit: planLimits.limit, period: planLimits.period })
    .from(planLimits);
  const table = Object.fromEntries(PLANS.map((plan) => [plan, [] as FeatureLimitDto[]])) as Record<
    Plan,
    FeatureLimitDto[]
  >;
  for (const plan of PLANS) {
    for (const feature of PLAN_FEATURES) {
      const row = rows.find((r) => r.plan === plan && r.feature === feature);
      // Same rule as limitFor(): a missing row means the seed didn't run. Fail closed, loudly.
      if (!row) throw new Error(`No plan limit for ${plan}.${feature}; run pnpm db:seed`);
      table[plan].push({ feature, limit: row.limit, period: row.period });
    }
  }
  return table;
}

async function loadUsage(userId: string, now: Date): Promise<UsageDto[]> {
  return Promise.all(
    METERED_FEATURES.map(async (feature) => toUsageDto({ ...(await usageFor(userId, feature, now)), feature })),
  );
}

/** Settings → Plan & billing, for the signed-in viewer only. */
export const getBillingStatus = cache(async (): Promise<BillingStatusDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const now = new Date();
  const [entitlement, records, usage] = await Promise.all([
    getEntitlement(userId, now),
    loadBillingRecords(userId),
    loadUsage(userId, now),
  ]);
  return {
    ...describePlan(entitlement, records.subs, now),
    canManageBilling: records.hasCustomer,
    trialAvailable: records.trialAvailable,
    usage,
  };
});

/** The Pricing page: every plan with its prices and limits, plus what the viewer can do. */
export const getPricing = cache(async (): Promise<PricingDto> => {
  const session = await getSession();
  const table = await loadLimitTable();
  const plans = PLANS.map((plan) => {
    const prices = plan === "free" ? null : pricesOf(plan);
    return { plan, prices, yearlySavingsPercent: prices ? yearlySavingsPercent(prices) : null, limits: table[plan] };
  });
  if (!session) return { plans, viewer: { signedIn: false } };

  const [entitlement, records] = await Promise.all([
    getEntitlement(session.user.id),
    loadBillingRecords(session.user.id),
  ]);
  const viewer: PricingViewerDto = {
    signedIn: true,
    plan: entitlement.plan,
    source: sourceOf(entitlement),
    subscribed: records.subscribed,
    trialAvailable: records.trialAvailable,
  };
  return { plans, viewer };
});

/** What the upgrade sheet shows for a feature the person just ran out of (or doesn't have). */
export async function getUpgradeOffer(userId: string, feature: PlanFeature): Promise<UpgradeOfferDto> {
  const now = new Date();
  const [entitlement, records, table] = await Promise.all([
    getEntitlement(userId, now),
    loadBillingRecords(userId),
    loadLimitTable(),
  ]);
  const limitOn = (plan: Plan) => table[plan].find((l) => l.feature === feature)!;
  const usage = isMeteredFeature(feature) ? toUsageDto({ ...(await usageFor(userId, feature, now)), feature }) : null;
  return {
    feature,
    plan: entitlement.plan,
    current: limitOn(entitlement.plan),
    usage,
    options: PAID_PLANS.filter((plan) => PLAN_RANK[plan] > PLAN_RANK[entitlement.plan]).map((plan) => ({
      plan,
      prices: pricesOf(plan),
      limit: limitOn(plan),
    })),
    trialAvailable: records.trialAvailable,
    subscribed: records.subscribed,
  };
}

/** One metered feature's tries left, for a meter next to that feature (e.g. "Import from a link"). */
export const getFeatureUsage = cache(async (feature: (typeof METERED_FEATURES)[number]): Promise<UsageDto | null> => {
  const session = await getSession();
  if (!session) return null;
  return toUsageDto({ ...(await usageFor(session.user.id, feature)), feature });
});
