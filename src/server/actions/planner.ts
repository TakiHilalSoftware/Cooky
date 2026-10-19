"use server";

import { and, count, eq, gte, lte } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import { addDays, daysBetween, weekDays, weekStartOf } from "@/lib/dates";
import type { ActionErrorCode } from "@/lib/errors";
import { getDb, type Executor } from "@/server/db/client";
import { cookLog, plannedMeals } from "@/server/db/schema";
import { findOwnDish } from "@/server/features/dishes/policy";
import { loadPlannedMeals, ownedDishIds } from "@/server/features/planner/queries";
import {
  addPlannedMealSchema,
  copyWeekSchema,
  moveCookLogSchema,
  movePlannedMealSchema,
  plannedMealIdSchema,
  repeatPlannedMealSchema,
  restoreCookLogSchema,
} from "@/server/features/planner/schema";
import { requestToday } from "@/server/time";

import { userAction } from "./_clients";

/** Planning reaches two years either way: far enough for any real plan, bounded for abuse. */
const PLAN_REACH_DAYS = 730;
/** A day holds at most this many meals. */
const MEALS_PER_DAY = 20;

function refreshPlanning() {
  revalidatePath("/[locale]", "layout");
}

async function assertInReach(dates: string[]) {
  const today = await requestToday();
  if (dates.some((d) => Math.abs(daysBetween(today, d)) > PLAN_REACH_DAYS))
    returnServerError<ActionErrorCode>("invalid");
}

async function assertRoom(executor: Executor, userId: string, date: string, adding = 1) {
  const [row] = await executor
    .select({ value: count() })
    .from(plannedMeals)
    .where(and(eq(plannedMeals.userId, userId), eq(plannedMeals.date, date)));
  if ((row?.value ?? 0) + adding > MEALS_PER_DAY) returnServerError<ActionErrorCode>("conflict");
}

async function findOwnPlannedMeal(userId: string, id: string) {
  const [meal] = await getDb()
    .select()
    .from(plannedMeals)
    .where(and(eq(plannedMeals.id, id), eq(plannedMeals.userId, userId)))
    .limit(1);
  return meal ?? null;
}

/** Puts a dish on a day (drag and drop, or tap a dish then a day's "+"). */
export const addPlannedMeal = userAction
  .metadata({ actionName: "addPlannedMeal" })
  .inputSchema(addPlannedMealSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    if (!(await findOwnDish(ctx.user.id, input.dishId))) returnServerError<ActionErrorCode>("not_found");
    await assertInReach([input.date]);
    const meal = await getDb().transaction(async (tx) => {
      await assertRoom(tx, ctx.user.id, input.date);
      const [row] = await tx
        .insert(plannedMeals)
        .values({ userId: ctx.user.id, dishId: input.dishId, date: input.date, mealSlot: input.mealSlot })
        .returning({
          id: plannedMeals.id,
          dishId: plannedMeals.dishId,
          date: plannedMeals.date,
          mealSlot: plannedMeals.mealSlot,
        });
      return row!;
    });
    refreshPlanning();
    return meal;
  });

/** Moves a planned meal to another day (and slot): planner drag and drop, or the calendar. */
export const movePlannedMeal = userAction
  .metadata({ actionName: "movePlannedMeal" })
  .inputSchema(movePlannedMealSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const meal = await findOwnPlannedMeal(ctx.user.id, input.id);
    if (!meal) returnServerError<ActionErrorCode>("not_found");
    await assertInReach([input.date]);
    await getDb().transaction(async (tx) => {
      if (input.date !== meal.date) await assertRoom(tx, ctx.user.id, input.date);
      await tx
        .update(plannedMeals)
        .set({ date: input.date, ...(input.mealSlot !== undefined ? { mealSlot: input.mealSlot } : {}) })
        .where(eq(plannedMeals.id, meal.id));
    });
    refreshPlanning();
    return { id: meal.id, date: input.date };
  });

/** Removes at once; the page offers Undo, which adds the same dish back to the same day and slot. */
export const removePlannedMeal = userAction
  .metadata({ actionName: "removePlannedMeal" })
  .inputSchema(plannedMealIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const [removed] = await getDb()
      .delete(plannedMeals)
      .where(and(eq(plannedMeals.id, id), eq(plannedMeals.userId, ctx.user.id)))
      .returning({ dishId: plannedMeals.dishId, date: plannedMeals.date, mealSlot: plannedMeals.mealSlot });
    if (!removed) returnServerError<ActionErrorCode>("not_found");
    refreshPlanning();
    return removed;
  });

/** "Copy last week" (PRD §3.5): every meal of one week onto the same weekday of another, skipping exact repeats. */
export const copyPlannerWeek = userAction
  .metadata({ actionName: "copyPlannerWeek" })
  .inputSchema(copyWeekSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const from = weekStartOf(input.from);
    const to = weekStartOf(input.to);
    if (from === to) returnServerError<ActionErrorCode>("invalid");
    await assertInReach([from, to]);
    const shift = daysBetween(from, to);
    const [source, existing] = await Promise.all([
      loadPlannedMeals(ctx.user.id, from, addDays(from, 6)),
      loadPlannedMeals(ctx.user.id, to, addDays(to, 6)),
    ]);
    const owned = await ownedDishIds(
      ctx.user.id,
      source.map((m) => m.dishId),
    );
    const key = (m: { dishId: string; date: string; mealSlot: string | null }) => `${m.dishId}|${m.date}|${m.mealSlot}`;
    const already = new Set(existing.map(key));
    const copies = source
      .filter((m) => owned.has(m.dishId))
      .map((m) => ({ userId: ctx.user.id, dishId: m.dishId, date: addDays(m.date, shift), mealSlot: m.mealSlot }))
      .filter((m) => !already.has(key(m)));
    if (copies.length > 0) {
      await getDb().transaction(async (tx) => {
        for (const day of weekDays(to)) {
          const adding = copies.filter((c) => c.date === day).length;
          if (adding > 0) await assertRoom(tx, ctx.user.id, day, adding);
        }
        await tx.insert(plannedMeals).values(copies);
      });
    }
    refreshPlanning();
    return { copied: copies.length };
  });

/** "Repeat a meal" (PRD §3.5): the same dish and slot on the days picked. */
export const repeatPlannedMeal = userAction
  .metadata({ actionName: "repeatPlannedMeal" })
  .inputSchema(repeatPlannedMealSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const meal = await findOwnPlannedMeal(ctx.user.id, input.id);
    if (!meal) returnServerError<ActionErrorCode>("not_found");
    const dates = [...new Set(input.dates)].filter((d) => d !== meal.date);
    await assertInReach(dates);
    const existing = await getDb()
      .select({ date: plannedMeals.date })
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.userId, ctx.user.id),
          eq(plannedMeals.dishId, meal.dishId),
          gte(
            plannedMeals.date,
            dates.reduce((a, b) => (a < b ? a : b), meal.date),
          ),
          lte(
            plannedMeals.date,
            dates.reduce((a, b) => (a > b ? a : b), meal.date),
          ),
        ),
      );
    const taken = new Set(existing.map((e) => e.date));
    const fresh = dates.filter((d) => !taken.has(d));
    if (fresh.length > 0) {
      await getDb().transaction(async (tx) => {
        for (const day of fresh) await assertRoom(tx, ctx.user.id, day);
        await tx
          .insert(plannedMeals)
          .values(fresh.map((date) => ({ userId: ctx.user.id, dishId: meal.dishId, date, mealSlot: meal.mealSlot })));
      });
    }
    refreshPlanning();
    return { added: fresh.length };
  });

/** Calendar: a cooked entry moved to the day it really happened. */
export const moveCookLog = userAction
  .metadata({ actionName: "moveCookLog" })
  .inputSchema(moveCookLogSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await assertInReach([input.date]);
    const [moved] = await getDb()
      .update(cookLog)
      .set({ date: input.date })
      .where(and(eq(cookLog.id, input.id), eq(cookLog.userId, ctx.user.id)))
      .returning({ id: cookLog.id, date: cookLog.date });
    if (!moved) returnServerError<ActionErrorCode>("not_found");
    refreshPlanning();
    return moved;
  });

/** Undo for removing a cooked entry from the calendar: the same dish, day and slot again. */
export const restoreCookLog = userAction
  .metadata({ actionName: "restoreCookLog" })
  .inputSchema(restoreCookLogSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    if (!(await findOwnDish(ctx.user.id, input.dishId))) returnServerError<ActionErrorCode>("not_found");
    await assertInReach([input.date]);
    const [row] = await getDb()
      .insert(cookLog)
      .values({ userId: ctx.user.id, ...input })
      .returning({ id: cookLog.id });
    refreshPlanning();
    return row!;
  });
