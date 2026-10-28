import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { cache } from "react";
import type { z } from "zod";

import type { AppLocale } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { dishes, spinSessions } from "@/server/db/schema";
import { getFeatureUsage } from "@/server/features/billing/queries";
import { loadCollectionDishIds, loadCollections } from "@/server/features/collections/queries";
import { extraHave, loadHave, loadRankableDishes } from "@/server/features/cook/queries";
import { rankDishes } from "@/server/features/cook/service";
import { dictionaryMatcher } from "@/server/features/ingredients/dictionary";
import { filterByIngredients } from "@/server/features/ingredients/service";
import { loadProfile } from "@/server/features/profile/queries";
import { dishSmallPhotoUrl } from "@/server/features/dishes/photo";
import { requestToday } from "@/server/time";
import { loadWeatherContext } from "@/server/weather/queries";
import { favouredSeasons } from "@/server/weather/service";

import type { SpinPageDto, SpinResultDto } from "./dto";
import type { spinSchema } from "./schema";
import { pickWeighted, spinWeight } from "./service";

type SpinInput = z.infer<typeof spinSchema>;

export async function loadPickedToday(userId: string, today: string): Promise<string[]> {
  const [session] = await getDb()
    .select({ picked: spinSessions.pickedDishIds })
    .from(spinSessions)
    .where(and(eq(spinSessions.userId, userId), eq(spinSessions.date, today)))
    .limit(1);
  return session?.picked ?? [];
}

/**
 * One spin (ARCHITECTURE §5.7): the person's dishes, narrowed to a collection
 * and/or the ingredients they named (all, then any), minus today's picks,
 * then a weighted draw favouring today's weather. null = nothing left to pick.
 */
export async function drawSpin(
  userId: string,
  input: SpinInput,
  random: () => number = Math.random,
): Promise<{ result: SpinResultDto; today: string } | null> {
  const locale: AppLocale = input.locale;
  const [rankable, have, weather, profile, today] = await Promise.all([
    loadRankableDishes(userId, locale),
    loadHave(userId, locale),
    loadWeatherContext(userId),
    loadProfile(userId),
    requestToday(),
  ]);

  let pool = rankable;
  if (input.collectionId) {
    const ids = await loadCollectionDishIds(userId, input.collectionId);
    pool = pool.filter((d) => ids.has(d.id));
  }

  let matchMode: SpinResultDto["matchMode"] = null;
  if (input.mode === "ingredients" && input.ingredients.length > 0) {
    const lineMatches = await dictionaryMatcher(input.ingredients);
    const filtered = filterByIngredients(
      pool,
      (d) => d.lines.map((l) => ({ names: [l.name], ingredientId: l.ingredientId })),
      input.ingredients,
      lineMatches,
    );
    if (filtered.mode === "none") return null;
    pool = filtered.items;
    matchMode = filtered.mode;
  }

  const picked = new Set(await loadPickedToday(userId, today));
  pool = pool.filter((d) => !picked.has(d.id));
  if (pool.length === 0) return null;

  const extras = input.mode === "ingredients" ? await extraHave(input.ingredients) : [];
  const ranked = rankDishes(pool, {
    have: [...have.map((h) => h.item), ...extras],
    favoured: favouredSeasons(weather.mood, weather.season),
    dietaryPrefs: profile?.dietaryPrefs ?? [],
    today,
  });
  const choice = pickWeighted(
    ranked.map((r) => ({ ...r, weight: spinWeight(r.weatherFit) })),
    random,
  );
  if (!choice) return null;
  const dish = pool.find((d) => d.id === choice.id)!;
  return {
    today,
    result: {
      matchMode,
      dish: {
        id: dish.id,
        name: dish.name,
        course: dish.course,
        photoUrl: await dishSmallPhotoUrl(dish),
        missing: choice.missing,
        weatherFit: choice.weatherFit === 2,
        dietFit: choice.dietFit,
        daysSinceCooked: choice.daysSinceCooked,
        planned: choice.planned,
        usualCount: choice.usualCount,
      },
    },
  };
}

export const getSpinPage = cache(async (locale: AppLocale): Promise<SpinPageDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const today = await requestToday();
  const [usage, userCollections, pickedIds, have, total] = await Promise.all([
    getFeatureUsage("spins"),
    loadCollections(userId),
    loadPickedToday(userId, today),
    loadHave(userId, locale),
    getDb()
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt))),
  ]);
  const names =
    pickedIds.length > 0
      ? await getDb()
          .select({ id: dishes.id, name: dishes.name })
          .from(dishes)
          .where(and(eq(dishes.userId, userId), inArray(dishes.id, pickedIds)))
      : [];
  return {
    usage,
    total: total.length,
    collections: userCollections,
    pickedToday: pickedIds.flatMap((id) => names.filter((n) => n.id === id)),
    kitchen: have.filter((h) => !h.isStaple).map((h) => h.display),
  };
});
