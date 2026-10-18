import "server-only";

import { and, eq } from "drizzle-orm";

import type { Plan } from "@config/plans";
import type { LimitPeriod, PlanFeature } from "@/lib/plan-features";
import { getDb, type Executor } from "@/server/db/client";
import { entitlements, planLimits } from "@/server/db/schema";

export type Entitlement = {
  plan: Plan;
  /** Start of the billing period (monthly allowances are anchored here); null on Free. */
  billingAnchor: Date | null;
  periodEnd: Date | null;
};

const FREE: Entitlement = { plan: "free", billingAnchor: null, periodEnd: null };

/**
 * A paid entitlement whose period ended more than a day ago is treated as
 * Free until the next webhook or reconcile rewrites it (ARCHITECTURE §5.3).
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** The plan a person has right now, only ever from the database (AGENT_RULES §4). */
export async function getEntitlement(
  userId: string,
  now = new Date(),
  executor: Executor = getDb(),
): Promise<Entitlement> {
  const [row] = await executor.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
  if (!row || row.plan === "free") return FREE;
  if (row.periodEnd && now.getTime() - row.periodEnd.getTime() > STALE_AFTER_MS) return FREE;
  return { plan: row.plan, billingAnchor: row.periodStart, periodEnd: row.periodEnd };
}

export type PlanLimit = { limit: number | null; period: LimitPeriod };

/** `plan_limits[plan][feature]`; never a constant in code (AGENT_RULES §4). */
export async function limitFor(plan: Plan, feature: PlanFeature, executor: Executor = getDb()): Promise<PlanLimit> {
  const [row] = await executor
    .select({ limit: planLimits.limit, period: planLimits.period })
    .from(planLimits)
    .where(and(eq(planLimits.plan, plan), eq(planLimits.feature, feature)))
    .limit(1);
  // A missing row means the seed didn't run: fail closed, loudly.
  if (!row) throw new Error(`No plan limit for ${plan}.${feature}; run pnpm db:seed`);
  return row;
}
