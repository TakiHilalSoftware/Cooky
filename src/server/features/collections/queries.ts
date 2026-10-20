import "server-only";

import { and, asc, count, eq, isNull } from "drizzle-orm";

import { getDb, type Executor } from "@/server/db/client";
import { collectionDishes, collections, dishes } from "@/server/db/schema";
import { getEntitlement, limitFor } from "@/server/quota/entitlement";

import type { CollectionAllowanceDto, CollectionDto } from "./dto";

/** The caller's own, not-deleted collection, or null (someone else's looks missing). */
export async function findOwnCollection(userId: string, collectionId: string, executor: Executor = getDb()) {
  const [row] = await executor
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId), isNull(collections.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** How many collections the person has against their plan's cap (`plan_limits.collections`). */
export async function loadCollectionAllowance(
  userId: string,
  executor: Executor = getDb(),
): Promise<CollectionAllowanceDto> {
  const [[row], { plan }] = await Promise.all([
    executor
      .select({ n: count() })
      .from(collections)
      .where(and(eq(collections.userId, userId), isNull(collections.deletedAt))),
    getEntitlement(userId),
  ]);
  const { limit } = await limitFor(plan, "collections", executor);
  const n = row?.n ?? 0;
  return { count: n, limit, canAdd: limit === null || n < limit };
}

/** The caller's collections, in their order, with how many live dishes each holds. */
export async function loadCollections(userId: string): Promise<CollectionDto[]> {
  // Joins (not a correlated subquery): with one table in FROM, Drizzle leaves
  // columns unqualified, and a subquery's "id" would then mean the wrong table.
  return getDb()
    .select({ id: collections.id, name: collections.name, dishCount: count(dishes.id) })
    .from(collections)
    .leftJoin(collectionDishes, eq(collectionDishes.collectionId, collections.id))
    .leftJoin(dishes, and(eq(dishes.id, collectionDishes.dishId), isNull(dishes.deletedAt)))
    .where(and(eq(collections.userId, userId), isNull(collections.deletedAt)))
    .groupBy(collections.id)
    .orderBy(asc(collections.position), asc(collections.createdAt));
}

/** The dishes in one of the caller's collections (empty for someone else's or a deleted one). Cook and Spin filter by it. */
export async function loadCollectionDishIds(userId: string, collectionId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ dishId: collectionDishes.dishId })
    .from(collectionDishes)
    .innerJoin(collections, eq(collections.id, collectionDishes.collectionId))
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId), isNull(collections.deletedAt)));
  return new Set(rows.map((r) => r.dishId));
}

/** Which of the caller's collections a dish is in. */
export async function loadDishCollectionIds(userId: string, dishId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: collectionDishes.collectionId })
    .from(collectionDishes)
    .innerJoin(collections, eq(collections.id, collectionDishes.collectionId))
    .where(and(eq(collectionDishes.dishId, dishId), eq(collections.userId, userId), isNull(collections.deletedAt)));
  return rows.map((r) => r.id);
}
