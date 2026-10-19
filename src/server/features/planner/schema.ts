// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { isDay } from "@/lib/dates";
import { COOK_SOURCES, MEAL_SLOTS } from "@/lib/dishes";

export const daySchema = z.string().refine(isDay, "invalidDate");

/** ?week= / ?month= from the URL; anything odd falls back to today. */
export const plannerParamsSchema = z.object({
  week: daySchema.optional().catch(undefined),
});
export const calendarParamsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
});

export const addPlannedMealSchema = z.object({
  dishId: z.uuid(),
  date: daySchema,
  mealSlot: z.enum(MEAL_SLOTS).nullable().default(null),
});
export const movePlannedMealSchema = z.object({
  id: z.uuid(),
  date: daySchema,
  mealSlot: z.enum(MEAL_SLOTS).nullable().optional(),
});
export const plannedMealIdSchema = z.object({ id: z.uuid() });
export const copyWeekSchema = z.object({ from: daySchema, to: daySchema });
export const repeatPlannedMealSchema = z.object({ id: z.uuid(), dates: z.array(daySchema).min(1).max(14) });

export const moveCookLogSchema = z.object({ id: z.uuid(), date: daySchema });
export const restoreCookLogSchema = z.object({
  dishId: z.uuid(),
  date: daySchema,
  mealSlot: z.enum(MEAL_SLOTS).nullable().default(null),
  source: z.enum(COOK_SOURCES).default("cook"),
});
