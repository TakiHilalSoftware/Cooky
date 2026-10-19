import "server-only";

import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { cookLog, dishes, dishIngredients, ingredients, pantryItems } from "@/server/db/schema";
import { catalogNamesFor } from "@/server/features/dishes/queries";
import { resolveIngredientIds } from "@/server/features/ingredients/dictionary";
import { allNames } from "@/server/features/ingredients/service";
import { loadProfile } from "@/server/features/profile/queries";
import { smallPhotoUrl } from "@/server/storage/photos";
import { requestToday } from "@/server/time";
import { loadWeatherContext } from "@/server/weather/queries";
import { favouredSeasons } from "@/server/weather/service";

import type { CookDto, CookHaveDto } from "./dto";
import type { CookFilters } from "./schema";
import { isHad, rankDishes, type HaveItem, type RankableDish, type RankLine } from "./service";

/** Enough for a long scroll; the rest are further down anyway. */
const SHOWN = 60;

const localName = (locale: AppLocale) =>
  locale === "fr" ? ingredients.nameFr : locale === "ar" ? ingredients.nameAr : ingredients.nameEn;

/** Everything Cook ranks for one person: their dishes with ingredient lines and when each was last cooked. */
export async function loadRankableDishes(userId: string, locale: AppLocale) {
  const db = getDb();
  const own = await db
    .select({
      id: dishes.id,
      name: dishes.name,
      course: dishes.course,
      seasons: dishes.seasons,
      dietaryTags: dishes.dietaryTags,
      imageKey: dishes.imageKey,
      followsCatalog: dishes.followsCatalog,
      catalogDishId: dishes.catalogDishId,
    })
    .from(dishes)
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt)));
  if (own.length === 0) return [];
  const ids = own.map((d) => d.id);

  const [lines, cooked, catalogNames] = await Promise.all([
    db
      .select({
        dishId: dishIngredients.dishId,
        name: dishIngredients.name,
        ingredientId: dishIngredients.ingredientId,
        localName: localName(locale),
      })
      .from(dishIngredients)
      .leftJoin(ingredients, eq(ingredients.id, dishIngredients.ingredientId))
      .where(inArray(dishIngredients.dishId, ids))
      .orderBy(dishIngredients.dishId, dishIngredients.position),
    db
      .select({ dishId: cookLog.dishId, last: max(cookLog.date) })
      .from(cookLog)
      .where(eq(cookLog.userId, userId))
      .groupBy(cookLog.dishId),
    catalogNamesFor(
      own.filter((d) => d.followsCatalog && d.catalogDishId).map((d) => d.catalogDishId!),
      locale,
    ),
  ]);

  const linesOf = new Map<string, RankLine[]>();
  for (const l of lines) {
    const list = linesOf.get(l.dishId) ?? [];
    list.push({ name: l.name, displayName: l.localName ?? l.name, ingredientId: l.ingredientId });
    linesOf.set(l.dishId, list);
  }
  const lastCooked = new Map(cooked.map((c) => [c.dishId, c.last]));
  return own.map((d) => ({
    id: d.id,
    name: (d.followsCatalog && d.catalogDishId && catalogNames.get(d.catalogDishId)) || d.name,
    course: d.course,
    imageKey: d.imageKey,
    seasons: d.seasons,
    dietaryTags: d.dietaryTags,
    lines: linesOf.get(d.id) ?? [],
    lastCooked: lastCooked.get(d.id) ?? null,
  })) satisfies (RankableDish & { name: string })[];
}

/** The person's kitchen as matchable items, with ids and display names for the what-if bar. */
export async function loadHave(userId: string, locale: AppLocale) {
  const rows = await getDb()
    .select({
      id: pantryItems.id,
      name: pantryItems.name,
      isStaple: pantryItems.isStaple,
      ingredientId: pantryItems.ingredientId,
      nameEn: ingredients.nameEn,
      nameFr: ingredients.nameFr,
      nameAr: ingredients.nameAr,
      variants: ingredients.variants,
      display: sql<string>`coalesce(${localName(locale)}, ${pantryItems.name})`,
    })
    .from(pantryItems)
    .leftJoin(ingredients, eq(ingredients.id, pantryItems.ingredientId))
    .where(eq(pantryItems.userId, userId))
    .orderBy(pantryItems.isStaple, pantryItems.createdAt);
  return rows.map((r) => ({
    id: r.id,
    display: r.display,
    isStaple: r.isStaple,
    item: {
      ingredientId: r.ingredientId,
      names:
        r.nameEn !== null && r.nameFr !== null && r.nameAr !== null && r.variants !== null
          ? [r.name, ...allNames({ nameEn: r.nameEn, nameFr: r.nameFr, nameAr: r.nameAr, variants: r.variants })]
          : [r.name],
    } satisfies HaveItem,
  }));
}

/** Extra names typed on the Cook page, linked to the dictionary like everything else. */
export async function extraHave(names: string[]): Promise<HaveItem[]> {
  const ids = await resolveIngredientIds(names);
  return names.map((name, i) => ({ names: [name], ingredientId: ids[i] ?? null }));
}

/**
 * Cook (PRD §3.4): the person's dishes ranked by what they can make now,
 * then today's weather, their diet and how long since they cooked each.
 */
export const getCook = cache(async (filters: CookFilters, locale: AppLocale): Promise<CookDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const [rankable, have, extras, weather, profile, today] = await Promise.all([
    loadRankableDishes(userId, locale),
    loadHave(userId, locale),
    extraHave(filters.with),
    loadWeatherContext(userId),
    loadProfile(userId),
    requestToday(),
  ]);
  const left = new Set(filters.without);
  const ranked = rankDishes(rankable, {
    have: [...have.filter((h) => !left.has(h.id)).map((h) => h.item), ...extras],
    favoured: favouredSeasons(weather.mood, weather.season),
    dietaryPrefs: profile?.dietaryPrefs ?? [],
    today,
  }).slice(0, SHOWN);

  const byId = new Map(rankable.map((d) => [d.id, d]));
  const cards = await Promise.all(
    ranked.map(async (r) => {
      const dish = byId.get(r.id)!;
      return {
        id: dish.id,
        name: dish.name,
        course: dish.course,
        photoUrl: await smallPhotoUrl(dish.imageKey),
        missing: r.missing,
        weatherFit: r.weatherFit === 2,
        dietFit: r.dietFit,
        daysSinceCooked: r.daysSinceCooked,
      };
    }),
  );
  return {
    dishes: cards,
    total: rankable.length,
    have: have.map((h) => ({ id: h.id, name: h.display, isStaple: h.isStaple, active: !left.has(h.id) })),
    extras: filters.with,
    weather: weather.weather,
    season: weather.season,
  };
});

/** Kitchen items (not staples) this dish uses: offered as "used up?" when logging the cook. */
export const getKitchenUsedBy = cache(async (dishId: string, locale: AppLocale): Promise<CookHaveDto[]> => {
  const session = await getSession();
  if (!session) return [];
  const [lines, have] = await Promise.all([
    getDb()
      .select({ name: dishIngredients.name, ingredientId: dishIngredients.ingredientId })
      .from(dishIngredients)
      .innerJoin(dishes, eq(dishes.id, dishIngredients.dishId))
      .where(and(eq(dishes.id, dishId), eq(dishes.userId, session.user.id))),
    loadHave(session.user.id, locale),
  ]);
  const rankLines = lines.map((l) => ({ ...l, displayName: l.name }));
  return have
    .filter((h) => !h.isStaple && rankLines.some((line) => isHad(line, [h.item])))
    .map((h) => ({ id: h.id, name: h.display, isStaple: false, active: true }));
});
