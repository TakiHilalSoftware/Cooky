"use server";

import { and, eq, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { AssistantUnavailable } from "@/server/ai/chat";
import { getDb, type Executor } from "@/server/db/client";
import { eventDishes, events } from "@/server/db/schema";
import { hydratePicks } from "@/server/features/assistant/queries";
import { findOwnDish } from "@/server/features/dishes/policy";
import type { CourseSuggestionDto } from "@/server/features/events/dto";
import { findOwnEvent, upcomingEventAllowance } from "@/server/features/events/queries";
import {
  eventFieldsSchema,
  eventIdSchema,
  setEventDishSchema,
  suggestCourseSchema,
  updateEventSchema,
} from "@/server/features/events/schema";
import { suggestByAi, suggestByRules } from "@/server/features/events/suggest";
import { hasFeature } from "@/server/quota/tries";
import { requestToday } from "@/server/time";

import { meteredAction, userAction } from "./_clients";

function refreshEvents() {
  revalidatePath("/[locale]", "layout");
}

/** Upcoming events count against the plan's cap (`plan_limits.upcoming_events`), checked under a per-user lock. */
async function assertUpcomingRoom(tx: Executor, userId: string, date: string, today: string) {
  if (date < today) return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`events:${userId}`}))`);
  const allowance = await upcomingEventAllowance(userId, today, tx);
  if (!allowance.canAdd) returnServerError<ActionErrorCode>(allowance.limit === 0 ? "plan_required" : "quota_exceeded");
}

export const createEvent = userAction
  .metadata({ actionName: "createEvent" })
  .inputSchema(eventFieldsSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const today = await requestToday();
    const id = await getDb().transaction(async (tx) => {
      await assertUpcomingRoom(tx, ctx.user.id, input.date, today);
      const [row] = await tx
        .insert(events)
        .values({ userId: ctx.user.id, ...input })
        .returning({ id: events.id });
      return row!.id;
    });
    refreshEvents();
    return { id };
  });

export const updateEvent = userAction
  .metadata({ actionName: "updateEvent" })
  .inputSchema(updateEventSchema)
  .action(async ({ parsedInput: { id, ...input }, ctx }) => {
    const today = await requestToday();
    await getDb().transaction(async (tx) => {
      const event = await findOwnEvent(ctx.user.id, id, tx);
      if (!event) returnServerError<ActionErrorCode>("not_found");
      // Moving a past event into the future makes it upcoming again: it needs room too.
      if (event.date < today) await assertUpcomingRoom(tx, ctx.user.id, input.date, today);
      await tx.update(events).set(input).where(eq(events.id, event.id));
    });
    refreshEvents();
    return { id };
  });

/** Deleting an event is irreversible: the page asks first (PRD §3.10). */
export const deleteEvent = userAction
  .metadata({ actionName: "deleteEvent" })
  .inputSchema(eventIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const [removed] = await getDb()
      .delete(events)
      .where(and(eq(events.id, id), eq(events.userId, ctx.user.id)))
      .returning({ id: events.id });
    if (!removed) returnServerError<ActionErrorCode>("not_found");
    refreshEvents();
    return removed;
  });

/** One dish per course; null clears the course. */
export const setEventDish = userAction
  .metadata({ actionName: "setEventDish" })
  .inputSchema(setEventDishSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const event = await findOwnEvent(ctx.user.id, input.eventId);
    if (!event) returnServerError<ActionErrorCode>("not_found");
    if (input.dishId === null) {
      await getDb()
        .delete(eventDishes)
        .where(and(eq(eventDishes.eventId, event.id), eq(eventDishes.course, input.course)));
    } else {
      if (!(await findOwnDish(ctx.user.id, input.dishId))) returnServerError<ActionErrorCode>("not_found");
      await getDb()
        .insert(eventDishes)
        .values({ eventId: event.id, course: input.course, dishId: input.dishId })
        .onConflictDoUpdate({ target: [eventDishes.eventId, eventDishes.course], set: { dishId: input.dishId } });
    }
    refreshEvents();
    return { course: input.course, dishId: input.dishId };
  });

/** Rule-based Suggest (every plan): the best-ranked dish of that course. */
export const suggestCourse = userAction
  .metadata({ actionName: "suggestCourse" })
  .inputSchema(suggestCourseSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<CourseSuggestionDto> => {
    const event = await findOwnEvent(ctx.user.id, input.eventId);
    if (!event) returnServerError<ActionErrorCode>("not_found");
    const pick = await suggestByRules(ctx.user.id, event.id, input.course, input.exclude, input.locale);
    if (!pick) returnServerError<ActionErrorCode>("not_found");
    const [cards = []] = await hydratePicks(ctx.user.id, input.locale, [[pick]]);
    const card = cards[0];
    if (!card) returnServerError<ActionErrorCode>("not_found");
    return card;
  });

/** AI Suggest (Plus and Pro, uses an Assistant try); refunded when no provider answers. */
export const suggestCourseWithAi = meteredAction("assistant")
  .metadata({ actionName: "suggestCourseWithAi" })
  .inputSchema(suggestCourseSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<CourseSuggestionDto> => {
    if (!(await hasFeature(ctx.user.id, "ai_suggest"))) returnServerError<ActionErrorCode>("plan_required");
    const event = await findOwnEvent(ctx.user.id, input.eventId);
    if (!event) returnServerError<ActionErrorCode>("not_found");
    let pick;
    try {
      pick = await suggestByAi(ctx.user.id, event, input.course, input.exclude, input.locale);
    } catch (err) {
      if (err instanceof AssistantUnavailable) returnServerError<ActionErrorCode>("unavailable");
      throw err;
    }
    if (!pick) returnServerError<ActionErrorCode>("not_found");
    const [cards = []] = await hydratePicks(ctx.user.id, input.locale, [[pick]]);
    const card = cards[0];
    if (!card) returnServerError<ActionErrorCode>("not_found");
    return card;
  });
