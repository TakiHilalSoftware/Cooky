import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { catalogDishes, catalogIngredients, catalogSteps, dishes } from "@/server/db/schema";
import { scaleAmount } from "@/server/features/dishes/service";
import { dictionaryMatcher, type MatchableLine } from "@/server/features/ingredients/dictionary";
import { filterByIngredients } from "@/server/features/ingredients/service";

import type { CatalogCardDto, CatalogDishDto, DiscoverDto } from "./dto";
import type { DiscoverFilters } from "./schema";

type Localized = { en: string; fr: string | null; ar: string | null };

/** A catalog text in the viewer's language; English when that translation is missing. */
export const inLocale = (text: Localized, locale: AppLocale) =>
  (locale === "fr" ? text.fr : locale === "ar" ? text.ar : null) ?? text.en;

type CatalogRow = typeof catalogDishes.$inferSelect;

function toCard(row: CatalogRow, locale: AppLocale, saved: Set<string>, timers: Map<string, number>): CatalogCardDto {
  return {
    slug: row.slug,
    name: inLocale({ en: row.nameEn, fr: row.nameFr, ar: row.nameAr }, locale),
    description: inLocale({ en: row.descriptionEn, fr: row.descriptionFr, ar: row.descriptionAr }, locale),
    country: row.country,
    course: row.course,
    difficulty: row.difficulty,
    servings: row.servings,
    dietaryTags: row.dietaryTags,
    collections: row.collections,
    timerMinutes: timers.get(row.id) ?? null,
    saved: saved.has(row.id),
  };
}

/** Catalog ids the person already has a (live) copy of. */
async function savedCatalogIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await getDb()
    .select({ id: dishes.catalogDishId })
    .from(dishes)
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt), sql`${dishes.catalogDishId} is not null`));
  return new Set(rows.map((r) => r.id).filter((id): id is string => id !== null));
}

async function timerMinutes(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: catalogSteps.catalogDishId, seconds: sql<number>`sum(${catalogSteps.timerSeconds})::int` })
    .from(catalogSteps)
    .where(inArray(catalogSteps.catalogDishId, ids))
    .groupBy(catalogSteps.catalogDishId);
  return new Map(rows.filter((r) => r.seconds).map((r) => [r.id, Math.round(r.seconds / 60)]));
}

/** Catalog rows as cards for one viewer: their language, what they've saved, total step time. */
export async function toCatalogCards(
  rows: CatalogRow[],
  locale: AppLocale,
  userId: string | null,
): Promise<CatalogCardDto[]> {
  const [saved, timers] = await Promise.all([savedCatalogIds(userId), timerMinutes(rows.map((r) => r.id))]);
  return rows.map((row) => toCard(row, locale, saved, timers));
}

/** Discover (public): featured dishes, then the filtered catalog, and whether each is already saved. */
export const getDiscover = cache(async (filters: DiscoverFilters, locale: AppLocale): Promise<DiscoverDto> => {
  const session = await getSession();
  const db = getDb();
  const all = await db.select().from(catalogDishes).orderBy(asc(catalogDishes.nameEn));
  const [saved, timers] = await Promise.all([
    savedCatalogIds(session?.user.id ?? null),
    timerMinutes(all.map((d) => d.id)),
  ]);

  let matching = all.filter(
    (d) =>
      (!filters.country || d.country === filters.country) &&
      (!filters.course || d.course === filters.course) &&
      (!filters.diet || d.dietaryTags.includes(filters.diet)) &&
      (!filters.collection || d.collections.includes(filters.collection)),
  );

  let matchMode: DiscoverDto["matchMode"] = null;
  const wanted = (filters.have ?? "")
    .split(/[,،]/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (wanted.length > 0 && matching.length > 0) {
    const lines = await db
      .select({
        id: catalogIngredients.catalogDishId,
        en: catalogIngredients.nameEn,
        fr: catalogIngredients.nameFr,
        ar: catalogIngredients.nameAr,
        ingredientId: catalogIngredients.ingredientId,
      })
      .from(catalogIngredients)
      .where(
        inArray(
          catalogIngredients.catalogDishId,
          matching.map((d) => d.id),
        ),
      );
    // Every language's name counts: "tomate" finds a dish whatever language the page is in.
    const linesOf = (id: string): MatchableLine[] =>
      lines
        .filter((l) => l.id === id)
        .map((l) => ({
          names: [l.en, l.fr, l.ar].filter((n): n is string => Boolean(n)),
          ingredientId: l.ingredientId,
        }));
    const result = filterByIngredients(matching, (d) => linesOf(d.id), wanted, await dictionaryMatcher(wanted));
    matchMode = result.mode;
    matching = result.items;
  }

  return {
    featured: all.filter((d) => d.featured).map((d) => toCard(d, locale, saved, timers)),
    dishes: matching.map((d) => toCard(d, locale, saved, timers)),
    countries: [...new Set(all.map((d) => d.country))].sort(),
    matchMode,
    signedIn: Boolean(session),
  };
});

const HOME_DISHES = 10;

/**
 * The landing page's carousel (PRD §3.0): featured dishes for visitors; for
 * signed-in people, a fresh mix from the whole catalog, with what they saved.
 */
export const getHomeDishes = cache(async (locale: AppLocale): Promise<CatalogCardDto[]> => {
  const session = await getSession();
  const db = getDb();
  const rows = session
    ? await db
        .select()
        .from(catalogDishes)
        .orderBy(sql`random()`)
        .limit(HOME_DISHES)
    : await db
        .select()
        .from(catalogDishes)
        .where(eq(catalogDishes.featured, true))
        .orderBy(asc(catalogDishes.nameEn))
        .limit(HOME_DISHES);
  const [saved, timers] = await Promise.all([
    savedCatalogIds(session?.user.id ?? null),
    timerMinutes(rows.map((r) => r.id)),
  ]);
  return rows.map((row) => toCard(row, locale, saved, timers));
});

/** The catalog dish page (public), with ingredients scaled to `servings` on the server. */
export const getCatalogDish = cache(
  async (slug: string, locale: AppLocale, servings?: number): Promise<CatalogDishDto | null> => {
    const session = await getSession();
    const db = getDb();
    const [row] = await db.select().from(catalogDishes).where(eq(catalogDishes.slug, slug)).limit(1);
    if (!row) return null;
    const [contents, timers, savedCopy] = await Promise.all([
      loadCatalogContents(row.id, locale),
      timerMinutes([row.id]),
      session
        ? db
            .select({ id: dishes.id })
            .from(dishes)
            .where(and(eq(dishes.userId, session.user.id), eq(dishes.catalogDishId, row.id), isNull(dishes.deletedAt)))
            .limit(1)
        : Promise.resolve([]),
    ]);
    const savedDishId = savedCopy[0]?.id ?? null;
    const shownServings = servings ?? row.servings;
    return {
      ...toCard(row, locale, new Set(savedDishId ? [row.id] : []), timers),
      seasons: row.seasons,
      shownServings,
      ingredients: contents.ingredients.map((i) => ({
        ...i,
        amount: scaleAmount(i.amount, row.servings, shownServings),
      })),
      steps: contents.steps,
      savedDishId,
      signedIn: Boolean(session),
    };
  },
);

/** A catalog dish's name, ingredients and steps in one language (also what a saved copy shows). */
export async function loadCatalogContents(catalogDishId: string, locale: AppLocale) {
  const db = getDb();
  const [[row], lines, steps] = await Promise.all([
    db.select().from(catalogDishes).where(eq(catalogDishes.id, catalogDishId)).limit(1),
    db
      .select()
      .from(catalogIngredients)
      .where(eq(catalogIngredients.catalogDishId, catalogDishId))
      .orderBy(asc(catalogIngredients.position)),
    db
      .select()
      .from(catalogSteps)
      .where(eq(catalogSteps.catalogDishId, catalogDishId))
      .orderBy(asc(catalogSteps.position)),
  ]);
  return {
    name: row ? inLocale({ en: row.nameEn, fr: row.nameFr, ar: row.nameAr }, locale) : "",
    ingredients: lines.map((l) => ({
      name: inLocale({ en: l.nameEn, fr: l.nameFr, ar: l.nameAr }, locale),
      amount: l.amount,
      unit: l.unit,
      note: l.noteEn ? inLocale({ en: l.noteEn, fr: l.noteFr, ar: l.noteAr }, locale) : null,
    })),
    steps: steps.map((s) => ({
      text: inLocale({ en: s.textEn, fr: s.textFr, ar: s.textAr }, locale),
      timerMinutes: s.timerSeconds === null ? null : Math.round(s.timerSeconds / 60),
      prepDayBefore: false,
    })),
  };
}
