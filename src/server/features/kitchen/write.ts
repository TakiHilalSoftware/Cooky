import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { pantryItems } from "@/server/db/schema";
import { resolveIngredientIds } from "@/server/features/ingredients/dictionary";

import { PANTRY_LIMIT, pantryKey } from "./service";

/**
 * Adds names to someone's kitchen. Something already there isn't duplicated
 * ("Tomatoes" and "tomate" are one item); adding it as a staple marks it one,
 * and nothing is ever demoted. Returns "full" when the new items wouldn't fit.
 */
export async function addToPantry(userId: string, names: string[], staple: boolean): Promise<"added" | "full"> {
  const ids = await resolveIngredientIds(names);
  const rows = new Map<string, { name: string; ingredientId: string | null; key: string }>();
  names.forEach((name, i) => {
    const ingredientId = ids[i] ?? null;
    const key = pantryKey(name, ingredientId);
    if (!rows.has(key)) rows.set(key, { name, ingredientId, key });
  });
  if (rows.size === 0) return "added";

  return getDb().transaction(async (tx) => {
    // Serialises this person's adds so the cap holds under double taps.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`pantry:${userId}`}))`);
    const existing = await tx.select({ key: pantryItems.key }).from(pantryItems).where(eq(pantryItems.userId, userId));
    const known = new Set(existing.map((e) => e.key));
    const fresh = [...rows.keys()].filter((key) => !known.has(key)).length;
    if (existing.length + fresh > PANTRY_LIMIT) return "full";
    await tx
      .insert(pantryItems)
      .values([...rows.values()].map((row) => ({ ...row, userId, isStaple: staple })))
      .onConflictDoUpdate({
        target: [pantryItems.userId, pantryItems.key],
        set: { isStaple: sql`${pantryItems.isStaple} or excluded.is_staple` },
      });
    return "added";
  });
}
