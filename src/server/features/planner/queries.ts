import "server-only";

import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { addDays, addMonths, monthGrid, weekDays, weekStartOf } from "@/lib/dates";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { catalogDishes, collectionDishes, cookLog, dishes, plannedMeals } from "@/server/db/schema";
import { loadCollections } from "@/server/features/collections/queries";
import { loadEventsBetween } from "@/server/features/events/queries";
import { catalogNamesFor } from "@/server/features/dishes/queries";
import { dishSmallPhotoUrl } from "@/server/features/dishes/photo";
import { requestToday } from "@/server/time";

import type { CalendarDto, CalendarEntryDto, PlannerDto } from "./dto";

/** The person's live dishes with display names (a following Discover copy shows the catalog's name in their language). */
export async function loadDishNames(userId: string, locale: AppLocale) {
  const rows = await getDb()
    .select({
      id: dishes.id,
      name: dishes.name,
      course: dishes.course,
      imageKey: dishes.imageKey,
      catalogPhotoUrl: catalogDishes.photoUrl,
      followsCatalog: dishes.followsCatalog,
      catalogDishId: dishes.catalogDishId,
    })
    .from(dishes)
    .leftJoin(catalogDishes, eq(catalogDishes.id, dishes.catalogDishId))
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt)))
    .orderBy(asc(dishes.name));
  const catalogNames = await catalogNamesFor(
    rows.flatMap((r) => (r.followsCatalog && r.catalogDishId ? [r.catalogDishId] : [])),
    locale,
  );
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: (r.followsCatalog && r.catalogDishId && catalogNames.get(r.catalogDishId)) || r.name,
        course: r.course,
        imageKey: r.imageKey,
        catalogPhotoUrl: r.catalogPhotoUrl,
      },
    ]),
  );
}

/** Planned meals in a date range, for dishes that still exist (a deleted dish's meals simply don't show). */
export async function loadPlannedMeals(userId: string, from: string, to: string) {
  return getDb()
    .select({
      id: plannedMeals.id,
      dishId: plannedMeals.dishId,
      date: plannedMeals.date,
      mealSlot: plannedMeals.mealSlot,
    })
    .from(plannedMeals)
    .where(and(eq(plannedMeals.userId, userId), gte(plannedMeals.date, from), lte(plannedMeals.date, to)))
    .orderBy(asc(plannedMeals.date), asc(plannedMeals.createdAt));
}

/** The planner's week: Monday to Sunday around ?week= (or today), the meals on it, and the dish library. */
export const getPlanner = cache(async (week: string | undefined, locale: AppLocale): Promise<PlannerDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const today = await requestToday();
  const weekStart = weekStartOf(week ?? today);
  const days = weekDays(weekStart);
  const [names, meals, lastWeek, userCollections, memberships, weekEvents] = await Promise.all([
    loadDishNames(userId, locale),
    loadPlannedMeals(userId, weekStart, days[6]!),
    loadPlannedMeals(userId, addDays(weekStart, -7), addDays(weekStart, -1)),
    loadCollections(userId),
    getDb()
      .select({ dishId: collectionDishes.dishId, collectionId: collectionDishes.collectionId })
      .from(collectionDishes)
      .innerJoin(dishes, eq(dishes.id, collectionDishes.dishId))
      .where(eq(dishes.userId, userId)),
    loadEventsBetween(userId, weekStart, days[6]!),
  ]);
  const collectionsOf = new Map<string, string[]>();
  for (const m of memberships) collectionsOf.set(m.dishId, [...(collectionsOf.get(m.dishId) ?? []), m.collectionId]);

  const shown = meals.filter((m) => names.has(m.dishId));
  return {
    weekStart,
    days,
    today,
    meals: await Promise.all(
      shown.map(async (m) => {
        const dish = names.get(m.dishId)!;
        return { ...m, name: dish.name, photoUrl: await dishSmallPhotoUrl(dish) };
      }),
    ),
    events: weekEvents,
    library: [...names.values()].map((d) => ({
      id: d.id,
      name: d.name,
      course: d.course,
      collectionIds: collectionsOf.get(d.id) ?? [],
    })),
    collections: userCollections,
    lastWeekCount: lastWeek.filter((m) => names.has(m.dishId)).length,
  };
});

/** The calendar's month: planned and cooked meals on every day of its grid (PRD §3.5). */
export const getCalendar = cache(async (month: string | undefined, locale: AppLocale): Promise<CalendarDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const today = await requestToday();
  const shownMonth = month ?? today.slice(0, 7);
  const days = monthGrid(shownMonth);
  const from = days[0]!;
  const to = days.at(-1)!;
  const [names, planned, cooked, monthEvents] = await Promise.all([
    loadDishNames(userId, locale),
    loadPlannedMeals(userId, from, to),
    getDb()
      .select({
        id: cookLog.id,
        dishId: cookLog.dishId,
        date: cookLog.date,
        mealSlot: cookLog.mealSlot,
        source: cookLog.source,
      })
      .from(cookLog)
      .where(and(eq(cookLog.userId, userId), gte(cookLog.date, from), lte(cookLog.date, to)))
      .orderBy(asc(cookLog.date), asc(cookLog.createdAt)),
    loadEventsBetween(userId, from, to),
  ]);
  const entries: CalendarEntryDto[] = [
    ...planned.flatMap((p) => {
      const dish = names.get(p.dishId);
      return dish ? [{ kind: "planned" as const, ...p, name: dish.name }] : [];
    }),
    ...cooked.flatMap((c) => {
      const dish = names.get(c.dishId);
      return dish ? [{ kind: "cooked" as const, ...c, name: dish.name }] : [];
    }),
    ...monthEvents.map((e) => ({ kind: "event" as const, ...e })),
  ];
  return { month: shownMonth, days, today, entries };
});

/** Neighbouring months, for the calendar's arrows. */
export const neighbourMonths = (month: string) => ({ previous: addMonths(month, -1), next: addMonths(month, 1) });

/** Dishes (by id) the person owns and hasn't deleted: guards every planner write. */
export async function ownedDishIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await getDb()
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt), inArray(dishes.id, ids)));
  return new Set(rows.map((r) => r.id));
}
