import "server-only";

import { and, asc, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { COURSES } from "@/lib/dishes";
import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import { dishes, eventDishes, events } from "@/server/db/schema";
import { getFeatureUsage } from "@/server/features/billing/queries";
import { loadDishNames } from "@/server/features/planner/queries";
import { getEntitlement, limitFor } from "@/server/quota/entitlement";
import { hasFeature } from "@/server/quota/tries";
import { smallPhotoUrl } from "@/server/storage/photos";
import { requestToday } from "@/server/time";

import type { EventDto, EventsPageDto, EventSummaryDto } from "./dto";

const PAST_SHOWN = 20;

/** Upcoming = today or later, in the person's own calendar (the plan caps these). */
export async function countUpcomingEvents(
  userId: string,
  today: string,
  executor: Executor = getDb(),
): Promise<number> {
  const [row] = await executor
    .select({ value: count() })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.date, today)));
  return row?.value ?? 0;
}

export async function upcomingEventAllowance(userId: string, today: string, executor: Executor = getDb()) {
  const [countNow, { plan }] = await Promise.all([
    countUpcomingEvents(userId, today, executor),
    getEntitlement(userId),
  ]);
  const { limit } = await limitFor(plan, "upcoming_events", executor);
  return { count: countNow, limit, canAdd: limit === null || countNow < limit };
}

async function summaries(rows: { id: string; name: string; date: string; guests: number }[]) {
  if (rows.length === 0) return [];
  const courseCounts = await getDb()
    .select({ eventId: eventDishes.eventId, value: count() })
    .from(eventDishes)
    .where(
      inArray(
        eventDishes.eventId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(eventDishes.eventId);
  const byEvent = new Map(courseCounts.map((c) => [c.eventId, c.value]));
  return rows.map((r): EventSummaryDto => ({ ...r, courses: byEvent.get(r.id) ?? 0 }));
}

/** Events in a date range, for the planner, the calendar and the Assistant. */
export async function loadEventsBetween(userId: string, from: string, to: string) {
  return getDb()
    .select({ id: events.id, name: events.name, date: events.date, guests: events.guests })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.date, from), lte(events.date, to)))
    .orderBy(asc(events.date), asc(events.createdAt));
}

export const getEvents = cache(async (): Promise<EventsPageDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const today = await requestToday();
  const columns = { id: events.id, name: events.name, date: events.date, guests: events.guests };
  const [upcoming, past, allowance] = await Promise.all([
    getDb()
      .select(columns)
      .from(events)
      .where(and(eq(events.userId, userId), gte(events.date, today)))
      .orderBy(asc(events.date)),
    getDb()
      .select(columns)
      .from(events)
      .where(and(eq(events.userId, userId), lt(events.date, today)))
      .orderBy(desc(events.date))
      .limit(PAST_SHOWN),
    upcomingEventAllowance(userId, today),
  ]);
  return { upcoming: await summaries(upcoming), past: await summaries(past), allowance, today };
});

/** The caller's own event, or null (someone else's looks missing). */
export async function findOwnEvent(userId: string, id: string, executor: Executor = getDb()) {
  const [event] = await executor
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  return event ?? null;
}

export const getEvent = cache(async (id: string, locale: AppLocale): Promise<EventDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const event = await findOwnEvent(userId, id);
  if (!event) return null;
  const [chosen, names, servings, aiSuggest, assistantUsage] = await Promise.all([
    getDb().select().from(eventDishes).where(eq(eventDishes.eventId, event.id)),
    loadDishNames(userId, locale),
    getDb().select({ id: dishes.id, servings: dishes.servings }).from(dishes).where(eq(dishes.userId, userId)),
    hasFeature(userId, "ai_suggest"),
    getFeatureUsage("assistant"),
  ]);
  const servingsOf = new Map(servings.map((s) => [s.id, s.servings]));
  const courses = await Promise.all(
    COURSES.map(async (course) => {
      const row = chosen.find((c) => c.course === course);
      const dish = row ? names.get(row.dishId) : undefined;
      return {
        course,
        dish: dish
          ? {
              id: dish.id,
              name: dish.name,
              photoUrl: await smallPhotoUrl(dish.imageKey),
              servings: servingsOf.get(dish.id) ?? 1,
            }
          : null,
      };
    }),
  );
  return {
    id: event.id,
    name: event.name,
    date: event.date,
    guests: event.guests,
    courses,
    aiSuggest,
    assistantUsage,
    choices: [...names.values()].map((d) => ({ id: d.id, name: d.name, course: d.course })),
  };
});
