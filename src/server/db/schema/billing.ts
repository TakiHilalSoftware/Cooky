import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { INTERVALS, PAID_PLANS, PLANS } from "@config/plans";
import { LIMIT_PERIODS, PLAN_FEATURES } from "@/lib/plan-features";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const planEnum = pgEnum("plan", PLANS);
export const paidPlanEnum = pgEnum("paid_plan", PAID_PLANS);
export const billingIntervalEnum = pgEnum("billing_interval", INTERVALS);
export const planFeatureEnum = pgEnum("plan_feature", PLAN_FEATURES);
export const limitPeriodEnum = pgEnum("limit_period", LIMIT_PERIODS);
export const entitlementSourceEnum = pgEnum("entitlement_source", ["stripe", "comp", "trial"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);
export const usageStatusEnum = pgEnum("usage_status", ["reserved", "committed", "refunded"]);

/** Tier limits, seeded by scripts/seed-plan-limits.ts. limit null = unlimited, 0 = not on this plan. */
export const planLimits = pgTable(
  "plan_limits",
  {
    plan: planEnum("plan").notNull(),
    feature: planFeatureEnum("feature").notNull(),
    limit: integer("limit"),
    period: limitPeriodEnum("period").notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.plan, t.feature] })],
);

/** The plan a person has right now. No row = Free. Written only by webhooks, reconcile and admin comps. */
export const entitlements = pgTable("entitlements", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull(),
  source: entitlementSourceEnum("source").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  ...timestamps,
});

export const billingCustomers = pgTable("billing_customers", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  ...timestamps,
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    /** Stripe subscription id. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: paidPlanEnum("plan").notNull(),
    interval: billingIntervalEnum("interval").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    /** When the latest payment failed (start of the 7-day grace), if it did. */
    paymentFailedAt: timestamp("payment_failed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("subscriptions_user_id_idx").on(t.userId)],
);

/** One trial per account, ever (PRD §3.7). */
export const trialRedemptions = pgTable("trial_redemptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: paidPlanEnum("plan").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

/**
 * One trial per inbox, ever (PRD §3.7). Holds a keyed hash of the address
 * (server/billing/trial.ts), never the address itself, and has no user FK on
 * purpose: it outlives account deletion so a new account on the same email
 * doesn't get a second trial.
 */
export const trialEmailRedemptions = pgTable("trial_email_redemptions", {
  emailKey: text("email_key").primaryKey(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per user, feature and period: what's used and what's reserved right now. */
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: planFeatureEnum("feature").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    used: integer("used").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.feature, t.periodStart] })],
);

/** Ledger of every reservation and its outcome. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: planFeatureEnum("feature").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    status: usageStatusEnum("status").notNull().default("reserved"),
    /** What the try was for (e.g. an assistant thread id), for support and audits. */
    ref: text("ref"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("usage_events_user_id_idx").on(t.userId), index("usage_events_reserved_idx").on(t.status, t.at)],
);

/** Stripe events already processed: webhook replays change nothing. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});
