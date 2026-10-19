import "server-only";

import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import ical from "ical-generator";
import { cache } from "react";

import { addDays, dayIn } from "@/lib/dates";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { calendarFeeds, dishes, events, plannedMeals, profiles } from "@/server/db/schema";
import { env } from "@/server/env";
import { hasFeature } from "@/server/quota/tries";

import type { CalendarFeedDto } from "./dto";
import { FEED_TOKEN_RE, hashFeedToken } from "./service";

export const getCalendarFeed = cache(async (): Promise<CalendarFeedDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const [available, [feed]] = await Promise.all([
    hasFeature(session.user.id, "ical_feed"),
    getDb()
      .select({ createdAt: calendarFeeds.createdAt })
      .from(calendarFeeds)
      .where(and(eq(calendarFeeds.userId, session.user.id), isNull(calendarFeeds.revokedAt)))
      .orderBy(desc(calendarFeeds.createdAt))
      .limit(1),
  ]);
  return { available, active: Boolean(feed), createdAt: feed?.createdAt.toISOString() ?? null };
});

/** The feed's owner, when the token is real, not revoked, and the plan still includes it. */
export async function feedOwner(token: string): Promise<string | null> {
  if (!FEED_TOKEN_RE.test(token)) return null;
  const [feed] = await getDb()
    .select({ userId: calendarFeeds.userId })
    .from(calendarFeeds)
    .where(and(eq(calendarFeeds.tokenHash, hashFeedToken(token)), isNull(calendarFeeds.revokedAt)))
    .limit(1);
  if (!feed) return null;
  return (await hasFeature(feed.userId, "ical_feed")) ? feed.userId : null;
}

/** The calendar a feed serves: planned meals and events from a month back to three months ahead, as all-day entries. */
export async function buildFeed(userId: string): Promise<string> {
  const today = dayIn("UTC");
  const from = addDays(today, -30);
  const to = addDays(today, 90);
  const db = getDb();
  const [[profile], meals, upcoming] = await Promise.all([
    db.select({ locale: profiles.locale }).from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({
        id: plannedMeals.id,
        date: plannedMeals.date,
        slot: plannedMeals.mealSlot,
        dishId: dishes.id,
        name: dishes.name,
      })
      .from(plannedMeals)
      .innerJoin(dishes, eq(dishes.id, plannedMeals.dishId))
      .where(
        and(
          eq(plannedMeals.userId, userId),
          isNull(dishes.deletedAt),
          gte(plannedMeals.date, from),
          lte(plannedMeals.date, to),
        ),
      )
      .orderBy(asc(plannedMeals.date)),
    db
      .select({ id: events.id, name: events.name, date: events.date, guests: events.guests })
      .from(events)
      .where(and(eq(events.userId, userId), gte(events.date, from), lte(events.date, to))),
  ]);
  const locale = profile?.locale ?? "en";
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const calendar = ical({
    name: "Cooky",
    prodId: { company: "Cooky", product: "meal-plan", language: locale.toUpperCase() },
  });
  for (const meal of meals) {
    calendar.createEvent({
      id: `meal-${meal.id}@cooky`,
      start: new Date(`${meal.date}T00:00:00Z`),
      allDay: true,
      summary: meal.name,
      url: `${base}/${locale}/dishes/${meal.dishId}`,
    });
  }
  for (const event of upcoming) {
    calendar.createEvent({
      id: `event-${event.id}@cooky`,
      start: new Date(`${event.date}T00:00:00Z`),
      allDay: true,
      summary: event.name,
      url: `${base}/${locale}/planner/events/${event.id}`,
    });
  }
  return calendar.toString();
}
