// What the UI may know about plans and billing. Types only: safe for the UI.
// Never a Stripe object or a database row; dates are ISO strings.
import type { BillingInterval, PaidPlan, Plan } from "@config/plans";
import type { LimitPeriod, MeteredFeature, PlanFeature } from "@/lib/plan-features";

export type CheckoutResult =
  | { status: "redirect"; url: string; trial: boolean }
  /** Already paying: plan changes happen in the Customer Portal. */
  | { status: "already_subscribed" };

export type PortalResult = { url: string };

/** Display prices in euro cents, per billing interval. */
export type PlanPricesDto = Record<BillingInterval, number>;

/** One plan's allowance for one feature. limit null = unlimited, 0 = not on this plan. */
export type FeatureLimitDto = { feature: PlanFeature; limit: number | null; period: LimitPeriod };

/** "7 of 10 tries left", computed on the server. */
export type UsageDto = {
  feature: MeteredFeature;
  /** null = unlimited. */
  limit: number | null;
  /** Tries available right now; null = unlimited. */
  remaining: number | null;
  period: LimitPeriod;
  /** When the counter starts over. */
  resetsAt: string | null;
};

/** Where the current plan comes from. */
export type PlanSource = "free" | "trial" | "paid" | "comp";

/** What happens to the plan next, for the one line under its name. */
export type PlanNextDto =
  /** Paid and renewing: the next charge. */
  | { kind: "renews"; at: string }
  /** On a trial that becomes paid unless cancelled. */
  | { kind: "trial_converts"; at: string }
  /** Cancelled (or a comp that runs out): the plan stays until then, then Free. */
  | { kind: "ends"; at: string }
  /** A payment failed: the plan stays until the grace ends, then Free. */
  | { kind: "grace"; at: string }
  /** Free, or a comp with no end date. */
  | { kind: "none" };

/** Settings → Plan & billing. */
export type BillingStatusDto = {
  plan: Plan;
  source: PlanSource;
  interval: BillingInterval | null;
  /** The display price of the current plan and interval, in euro cents. */
  priceCents: number | null;
  next: PlanNextDto;
  /** A Stripe customer exists, so the Customer Portal can open. */
  canManageBilling: boolean;
  /** The account never had a trial (one per account, PRD §3.7). */
  trialAvailable: boolean;
  usage: UsageDto[];
};

export type PricingPlanDto = {
  plan: Plan;
  /** null for Free. */
  prices: PlanPricesDto | null;
  /** How much cheaper yearly is than 12 monthly payments, in whole percent. */
  yearlySavingsPercent: number | null;
  limits: FeatureLimitDto[];
};

export type PricingViewerDto =
  | { signedIn: false }
  | {
      signedIn: true;
      plan: Plan;
      source: PlanSource;
      /** Has a live Stripe subscription: plan changes go through the Customer Portal. */
      subscribed: boolean;
      trialAvailable: boolean;
    };

export type PricingDto = { plans: PricingPlanDto[]; viewer: PricingViewerDto };

/** A plan above the current one, as the upgrade sheet offers it. */
export type UpgradeOptionDto = {
  plan: PaidPlan;
  prices: PlanPricesDto;
  /** This feature's allowance on that plan. */
  limit: FeatureLimitDto;
};

/** Everything the upgrade sheet says when a limit is hit. */
export type UpgradeOfferDto = {
  feature: PlanFeature;
  plan: Plan;
  /** This feature's allowance on the current plan. */
  current: FeatureLimitDto;
  /** Metered features only: what's left and when it resets. */
  usage: UsageDto | null;
  /** Higher plans, cheapest first. Empty on the top plan. */
  options: UpgradeOptionDto[];
  trialAvailable: boolean;
  subscribed: boolean;
};
