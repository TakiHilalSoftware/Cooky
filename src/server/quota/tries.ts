import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";

import {
  isMeteredFeature,
  type CountedFeature,
  type GatedFeature,
  type LimitPeriod,
  type MeteredFeature,
  type PlanFeature,
} from "@/lib/plan-features";
import { getDb } from "@/server/db/client";
import { usageCounters, usageEvents } from "@/server/db/schema";

import { getEntitlement, limitFor } from "./entitlement";
import { periodEndFor, periodStartFor } from "./periods";

/** Why an action can't go ahead: out of tries for now, or not on this plan at all. */
export type QuotaDenial = "quota_exceeded" | "plan_required";

export type Reservation = { eventId: string; userId: string; feature: MeteredFeature; periodStart: Date };

/** Reservations older than this are given back by the cleanup job (ARCHITECTURE §5.2). */
export const RESERVATION_TTL_MS = 5 * 60 * 1000;

/**
 * Reserves one try before the work starts. A single conditional UPDATE, so
 * parallel requests can never exceed the limit.
 */
export async function reserve(
  userId: string,
  feature: MeteredFeature,
  ref?: string,
  now = new Date(),
): Promise<{ ok: true; reservation: Reservation } | { ok: false; reason: QuotaDenial }> {
  const db = getDb();
  const entitlement = await getEntitlement(userId, now);
  const { limit, period } = await limitFor(entitlement.plan, feature);
  if (limit === 0) return { ok: false, reason: "plan_required" };

  const periodStart = periodStartFor(period, entitlement.billingAnchor, now);
  await db.insert(usageCounters).values({ userId, feature, periodStart }).onConflictDoNothing();

  const [counter] = await db
    .update(usageCounters)
    .set({ reserved: sql`${usageCounters.reserved} + 1` })
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.feature, feature),
        eq(usageCounters.periodStart, periodStart),
        limit === null ? undefined : sql`${usageCounters.used} + ${usageCounters.reserved} < ${limit}`,
      ),
    )
    .returning({ used: usageCounters.used });
  if (!counter) return { ok: false, reason: "quota_exceeded" };

  const [event] = await db
    .insert(usageEvents)
    .values({ userId, feature, periodStart, ref, at: now })
    .returning({ id: usageEvents.id });
  return { ok: true, reservation: { eventId: event!.id, userId, feature, periodStart } };
}

async function settle(reservation: Reservation, outcome: "committed" | "refunded") {
  await getDb().transaction(async (tx) => {
    // Only a still-open reservation can be settled, so a double settle is a no-op.
    const [event] = await tx
      .update(usageEvents)
      .set({ status: outcome })
      .where(and(eq(usageEvents.id, reservation.eventId), eq(usageEvents.status, "reserved")))
      .returning({ id: usageEvents.id });
    if (!event) return;
    await tx
      .update(usageCounters)
      .set({
        reserved: sql`greatest(${usageCounters.reserved} - 1, 0)`,
        ...(outcome === "committed" ? { used: sql`${usageCounters.used} + 1` } : {}),
      })
      .where(
        and(
          eq(usageCounters.userId, reservation.userId),
          eq(usageCounters.feature, reservation.feature),
          eq(usageCounters.periodStart, reservation.periodStart),
        ),
      );
  });
}

/** The work succeeded: the try is spent. */
export const commit = (reservation: Reservation) => settle(reservation, "committed");

/** The provider failed: the try is given back (PRD §3.7). */
export const refund = (reservation: Reservation) => settle(reservation, "refunded");

/** Gives back reservations whose work never reported back (crashed request). */
export async function releaseStaleReservations(now = new Date()): Promise<number> {
  const stale = await getDb()
    .select()
    .from(usageEvents)
    .where(and(eq(usageEvents.status, "reserved"), lt(usageEvents.at, new Date(now.getTime() - RESERVATION_TTL_MS))));
  for (const event of stale) {
    if (!isMeteredFeature(event.feature)) continue;
    await refund({ eventId: event.id, userId: event.userId, feature: event.feature, periodStart: event.periodStart });
  }
  return stale.length;
}

/** For counted features (dishes, collections…): may one more be added? */
export async function canAddAnother(
  userId: string,
  feature: CountedFeature,
  currentCount: number,
): Promise<{ ok: true } | { ok: false; reason: QuotaDenial }> {
  const { plan } = await getEntitlement(userId);
  const { limit } = await limitFor(plan, feature);
  if (limit === null || currentCount < limit) return { ok: true };
  return { ok: false, reason: limit === 0 ? "plan_required" : "quota_exceeded" };
}

/** For gated features (household list, iCal…): is it on this plan? */
export async function hasFeature(userId: string, feature: GatedFeature): Promise<boolean> {
  const { plan } = await getEntitlement(userId);
  const { limit } = await limitFor(plan, feature);
  return limit !== 0;
}

export type UsageSnapshot = {
  feature: PlanFeature;
  limit: number | null;
  period: LimitPeriod;
  used: number;
  /** Tries still available now (reservations in flight count as taken). */
  remaining: number | null;
  resetsAt: Date | null;
};

/** "7 of 10 tries left" for the UI: from the server, never computed in the browser. */
export async function usageFor(userId: string, feature: MeteredFeature, now = new Date()): Promise<UsageSnapshot> {
  const entitlement = await getEntitlement(userId, now);
  const { limit, period } = await limitFor(entitlement.plan, feature);
  const periodStart = periodStartFor(period, entitlement.billingAnchor, now);
  const [counter] = await getDb()
    .select({ used: usageCounters.used, reserved: usageCounters.reserved })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.feature, feature),
        eq(usageCounters.periodStart, periodStart),
      ),
    )
    .limit(1);
  const used = counter?.used ?? 0;
  const taken = used + (counter?.reserved ?? 0);
  return {
    feature,
    limit,
    period,
    used,
    remaining: limit === null ? null : Math.max(limit - taken, 0),
    resetsAt: periodEndFor(period, periodStart, entitlement.billingAnchor),
  };
}
