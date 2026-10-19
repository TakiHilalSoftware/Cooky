import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { AppLocale } from "@/i18n/routing";
import { getDb } from "@/server/db/client";
import { catalogDishes, dishes } from "@/server/db/schema";
import { loadDishAllowance } from "@/server/features/dishes/queries";
import { lockDishCount, writeContents } from "@/server/features/dishes/write";

import { loadCatalogContents } from "./queries";

export type SaveCopyResult =
  { status: "saved" | "already"; dishId: string } | { status: "missing" } | { status: "full" };

/**
 * Saves a Discover dish into someone's box (PRD §3.3): a copy linked to the
 * catalog, following their language until edited, with its own text too (in
 * `locale`) so it survives the catalog entry being retired. Shared by
 * "Save to my dishes" and onboarding.
 */
export async function saveCatalogCopy(userId: string, slug: string, locale: AppLocale): Promise<SaveCopyResult> {
  const db = getDb();
  const [entry] = await db.select().from(catalogDishes).where(eq(catalogDishes.slug, slug)).limit(1);
  if (!entry) return { status: "missing" };
  const contents = await loadCatalogContents(entry.id, locale);
  return db.transaction(async (tx) => {
    await lockDishCount(tx, userId);
    const [existing] = await tx
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), eq(dishes.catalogDishId, entry.id), isNull(dishes.deletedAt)))
      .limit(1);
    if (existing) return { status: "already" as const, dishId: existing.id };
    if (!(await loadDishAllowance(userId, tx)).canAdd) return { status: "full" as const };
    const [row] = await tx
      .insert(dishes)
      .values({
        userId,
        name: contents.name,
        difficulty: entry.difficulty,
        course: entry.course,
        servings: entry.servings,
        seasons: entry.seasons,
        dietaryTags: entry.dietaryTags,
        catalogDishId: entry.id,
        followsCatalog: true,
      })
      .returning({ id: dishes.id });
    await writeContents(tx, row!.id, { ingredients: contents.ingredients, steps: contents.steps });
    return { status: "saved" as const, dishId: row!.id };
  });
}
