import "server-only";

import { ne } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { entitlements, subscriptions } from "@/server/db/schema";
import { logger } from "@/server/observability/logger";

import { recomputeEntitlement } from "./entitlements";
import { getStripe } from "./stripe";
import { syncSubscription } from "./sync";

/**
 * Nightly reconcile (ARCHITECTURE §5.3): re-reads every live subscription
 * from Stripe, then recomputes every entitlement, which also ends grace
 * periods and trials whose time ran out. Returns how many plans changed.
 */
export async function reconcileBilling(now = new Date()): Promise<{ synced: number; changed: number }> {
  const db = getDb();
  const live = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(ne(subscriptions.status, "canceled"));
  let synced = 0;
  for (const { id } of live) {
    try {
      const fresh = await getStripe().subscriptions.retrieve(id);
      await db.transaction((tx) => syncSubscription(fresh, tx));
      synced++;
    } catch (err) {
      logger.error({ err, subscriptionId: id }, "reconcile: subscription sync failed");
    }
  }

  const people = new Set([
    ...(await db.select({ userId: subscriptions.userId }).from(subscriptions)).map((r) => r.userId),
    ...(await db.select({ userId: entitlements.userId }).from(entitlements)).map((r) => r.userId),
  ]);
  let changed = 0;
  for (const userId of people) {
    const change = await db.transaction((tx) => recomputeEntitlement(userId, tx, now));
    if (change.from !== change.to) changed++;
  }
  if (changed > 0) logger.warn({ changed }, "reconcile: entitlements drifted and were corrected");
  return { synced, changed };
}
