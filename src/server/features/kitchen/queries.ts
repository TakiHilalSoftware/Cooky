import "server-only";

import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import { ingredients, pantryItems } from "@/server/db/schema";
import { allNames } from "@/server/features/ingredients/service";

import type { PantryDto } from "./dto";
import { PANTRY_LIMIT } from "./service";

const localName = (locale: AppLocale) =>
  locale === "fr" ? ingredients.nameFr : locale === "ar" ? ingredients.nameAr : ingredients.nameEn;

/** The kitchen page: staples and what's in now, named in the viewer's language. */
export const getPantry = cache(async (locale: AppLocale): Promise<PantryDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: pantryItems.id,
      name: sql<string>`coalesce(${localName(locale)}, ${pantryItems.name})`,
      isStaple: pantryItems.isStaple,
      ingredientId: pantryItems.ingredientId,
    })
    .from(pantryItems)
    .leftJoin(ingredients, eq(ingredients.id, pantryItems.ingredientId))
    .where(eq(pantryItems.userId, session.user.id))
    .orderBy(asc(pantryItems.createdAt));

  const linked = rows.flatMap((r) => (r.ingredientId ? [r.ingredientId] : []));
  const staples = await db
    .select({ name: localName(locale) })
    .from(ingredients)
    .where(
      and(eq(ingredients.isCommonStaple, true), linked.length > 0 ? notInArray(ingredients.id, linked) : undefined),
    )
    .orderBy(asc(localName(locale)))
    .limit(16);

  return {
    items: rows.map(({ ingredientId: _ignored, ...item }) => item),
    suggestedStaples: staples.map((s) => s.name),
    limit: PANTRY_LIMIT,
  };
});

/** What the person has, as the matcher sees it (every language's name), for Cook, Spin and the Assistant. */
export type PantryLine = { names: string[]; ingredientId: string | null; isStaple: boolean };

export async function loadPantryLines(userId: string, executor: Executor = getDb()): Promise<PantryLine[]> {
  const rows = await executor
    .select({
      name: pantryItems.name,
      ingredientId: pantryItems.ingredientId,
      isStaple: pantryItems.isStaple,
      nameEn: ingredients.nameEn,
      nameFr: ingredients.nameFr,
      nameAr: ingredients.nameAr,
      variants: ingredients.variants,
    })
    .from(pantryItems)
    .leftJoin(ingredients, eq(ingredients.id, pantryItems.ingredientId))
    .where(eq(pantryItems.userId, userId));
  return rows.map((r) => ({
    names:
      r.nameEn !== null
        ? [r.name, ...allNames({ nameEn: r.nameEn, nameFr: r.nameFr!, nameAr: r.nameAr!, variants: r.variants! })]
        : [r.name],
    ingredientId: r.ingredientId,
    isStaple: r.isStaple,
  }));
}
