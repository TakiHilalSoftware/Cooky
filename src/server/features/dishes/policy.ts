import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDb, type Executor } from "@/server/db/client";
import { dishes } from "@/server/db/schema";

/**
 * The caller's own, not-deleted dish, or null. Someone else's dish and a
 * missing one look the same, so ids can't be probed (AGENT_RULES §3).
 * Friends' and groups' access arrives with sharing in Phase 6.
 */
export async function findOwnDish(userId: string, dishId: string, executor: Executor = getDb()) {
  const [dish] = await executor
    .select()
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.userId, userId), isNull(dishes.deletedAt)))
    .limit(1);
  return dish ?? null;
}
