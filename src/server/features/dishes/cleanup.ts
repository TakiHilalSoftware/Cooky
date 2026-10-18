import "server-only";

import { and, isNotNull, lt } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dishes } from "@/server/db/schema";

/** Deleted dishes stay restorable this long (the Undo toast lasts 6 s; this covers retries and other tabs). */
export const DELETED_DISH_TTL_MS = 24 * 60 * 60 * 1000;

/** Removes dishes deleted more than a day ago, with their ingredients, steps, notes and favorites (FK cascade). */
export async function purgeDeletedDishes(now = new Date()): Promise<number> {
  const purged = await getDb()
    .delete(dishes)
    .where(and(isNotNull(dishes.deletedAt), lt(dishes.deletedAt, new Date(now.getTime() - DELETED_DISH_TTL_MS))))
    .returning({ id: dishes.id });
  return purged.length;
}
