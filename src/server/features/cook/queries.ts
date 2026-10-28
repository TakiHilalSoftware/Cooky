import "server-only";

import { and, count, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  catalogDishes,
  cookLog,
  dishes,
  dishIngredients,
  ingredients,
  pantryItems,
  plannedMeals,
} from "@/server/db/schema";
import { loadCollectionDishIds, loadCollections } from "@/server/features/collections/queries";
import { dishSmallPhotoUrl } from "@/server/features/dishes/photo";
import { catalogNamesFor } from "@/server/features/dishes/queries";
import { resolveIngredientIds } from "@/server/features/ingredients/dictionary";
import { allNames } from "@/server/features/ingredients/service";
import { loadProfile } from "@/server/features/profile/queries";
import { requestClock, requestToday } from "@/server/time";
import { loadWeatherContext } from "@/server/weather/queries";
import { favouredSeasons } from "@/server/weather/service";

import type { CookDto, CookHaveDto, CookMealDto, ReadyDishDto, ReadyToCookDto } from "./dto";
import { MEAL_GRACE_MINUTES, mealMoment, mealsOfDay, nextMeal, type MealMoment } from "./meal";
import type { CookFilters } from "./schema";
import { isHad, rankDishes, splitReady, type HaveItem, type RankableDish, type RankLine } from "./service";

/** Enough for a long scroll; the rest are further down anyway. */
const SHOWN = 60;
/** Per list on My kitchen's "Ready to cook" panel; Cook has the full ranking. */
const READY_SHOWN = 6;

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
      catalogPhotoUrl: catalogDishes.photoUrl,
      followsCatalog: dishes.followsCatalog,
      catalogDishId: dishes.catalogDishId,
    })
    .from(dishes)
    .leftJoin(catalogDishes, eq(catalogDishes.id, dishes.catalogDishId))
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
    catalogPhotoUrl: d.catalogPhotoUrl,
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

/** For the meal Cook suggests for: what's planned for it, and how often each dish was logged for it. */
async function loadMealContext(userId: string, meal: MealMoment) {
  const db = getDb();
  const [planned, usual] = await Promise.all([
    db
      .select({ dishId: plannedMeals.dishId })
      .from(plannedMeals)
      .where(
        and(eq(plannedMeals.userId, userId), eq(plannedMeals.date, meal.date), eq(plannedMeals.mealSlot, meal.slot)),
      ),
    db
      .select({ dishId: cookLog.dishId, n: count() })
      .from(cookLog)
      .where(and(eq(cookLog.userId, userId), eq(cookLog.mealSlot, meal.slot)))
      .groupBy(cookLog.dishId),
  ]);
  return { planned: new Set(planned.map((p) => p.dishId)), usual: new Map(usual.map((u) => [u.dishId, u.n])) };
}

/**
 * Cook (PRD §3.4): the person's dishes for their next meal (or one they pick),
 * ranked by what's planned for it, what they can make now, what they usually
 * have then, today's weather, their diet and how long since they cooked each.
 */
export const getCook = cache(async (filters: CookFilters, locale: AppLocale): Promise<CookDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const [all, have, extras, weather, profile, clock, userCollections, inCollection] = await Promise.all([
    loadRankableDishes(userId, locale),
    loadHave(userId, locale),
    extraHave(filters.with),
    loadWeatherContext(userId),
    loadProfile(userId),
    requestClock(),
    loadCollections(userId),
    filters.collection ? loadCollectionDishIds(userId, filters.collection) : null,
  ]);
  // Someone else's (or a deleted) collection is ignored rather than showing nothing.
  const collection = userCollections.some((c) => c.id === filters.collection) ? filters.collection : null;
  const rankable = collection && inCollection ? all.filter((d) => inCollection.has(d.id)) : all;
  const left = new Set(filters.without);
  const times = profile?.mealTimes ?? null;
  const next = times ? nextMeal(times, clock) : null;
  // A meal picked on the rail, if they have it; otherwise the next one.
  const meal = (times && filters.meal ? mealMoment(filters.meal, times, clock) : null) ?? next;
  const mealContext = meal ? await loadMealContext(userId, meal) : undefined;
  const rankedAll = rankDishes(rankable, {
    have: [...have.filter((h) => !left.has(h.id)).map((h) => h.item), ...extras],
    favoured: favouredSeasons(weather.mood, weather.season),
    dietaryPrefs: profile?.dietaryPrefs ?? [],
    today: clock.today,
    meal: mealContext,
  });
  const ranked = rankedAll.slice(0, SHOWN);

  const byId = new Map(rankable.map((d) => [d.id, d]));
  const cards = await Promise.all(
    ranked.map(async (r) => {
      const dish = byId.get(r.id)!;
      return {
        id: dish.id,
        name: dish.name,
        course: dish.course,
        photoUrl: await dishSmallPhotoUrl(dish),
        missing: r.missing,
        weatherFit: r.weatherFit === 2,
        dietFit: r.dietFit,
        daysSinceCooked: r.daysSinceCooked,
        planned: r.planned,
        usualCount: r.usualCount,
      };
    }),
  );
  const mealDto: CookMealDto | null =
    meal && times
      ? {
          slot: meal.slot,
          at: meal.at,
          when: meal.when,
          inMinutes: meal.inMinutes,
          picked: meal.slot !== next?.slot,
          day: mealsOfDay(times).map((m) => ({ ...m, passed: clock.minutes >= m.at + MEAL_GRACE_MINUTES })),
          now: clock.minutes,
          plannedCount: rankedAll.filter((r) => r.planned).length,
          usualCount: rankedAll.filter((r) => r.usualCount > 0).length,
          // A cook logged now is today's; it belongs to this meal only if the meal is today's.
          logAs: meal.when === "tomorrow" ? null : meal.slot,
        }
      : null;
  return {
    dishes: cards,
    total: all.length,
    have: have.map((h) => ({ id: h.id, name: h.display, isStaple: h.isStaple, active: !left.has(h.id) })),
    extras: filters.with,
    collections: userCollections,
    collection,
    weather: weather.weather,
    season: weather.season,
    meal: mealDto,
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

/**
 * My kitchen's "Ready to cook" panel: which dishes the kitchen covers right
 * now, and which are one or two ingredients short. Ranked like Cook (minus
 * weather and diet, which don't change as the kitchen does).
 */
export async function loadReadyToCook(userId: string, locale: AppLocale): Promise<ReadyToCookDto> {
  const [rankable, have, today] = await Promise.all([
    loadRankableDishes(userId, locale),
    loadHave(userId, locale),
    requestToday(),
  ]);
  // A dish without ingredients isn't "ready": there's nothing to check it against.
  const ranked = rankDishes(
    rankable.filter((d) => d.lines.length > 0),
    {
      have: have.map((h) => h.item),
      favoured: [],
      dietaryPrefs: [],
      today,
    },
  );
  const { ready, almost, readyCount, almostCount } = splitReady(ranked, READY_SHOWN);
  const byId = new Map(rankable.map((d) => [d.id, d]));
  const card = async (r: { id: string; missing: string[] }): Promise<ReadyDishDto> => {
    const dish = byId.get(r.id)!;
    return {
      id: dish.id,
      name: dish.name,
      course: dish.course,
      photoUrl: await dishSmallPhotoUrl(dish),
      missing: r.missing,
    };
  };
  return {
    ready: await Promise.all(ready.map(card)),
    almost: await Promise.all(almost.map(card)),
    readyCount,
    almostCount,
    total: rankable.length,
  };
}

/** The kitchen page's first render of the panel. */
export const getReadyToCook = cache(async (locale: AppLocale): Promise<ReadyToCookDto | null> => {
  const session = await getSession();
  return session ? loadReadyToCook(session.user.id, locale) : null;
});
