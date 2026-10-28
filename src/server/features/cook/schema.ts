// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { COOK_SOURCES, MEAL_SLOTS } from "@/lib/dishes";

/** A URL value that may arrive once or repeated. */
const asList = (value: unknown) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/**
 * Cook's what-if, from the URL: extra ingredients on top of My kitchen
 * (?with=), kitchen items to leave out (?without=), one collection to choose
 * from (?collection=), and a meal other than the next one (?meal=). Anything
 * odd is ignored.
 */
export const cookFiltersSchema = z.object({
  with: z.preprocess(asList, z.array(z.string().trim().min(1).max(80)).max(10)).catch([]),
  without: z.preprocess(asList, z.array(z.uuid()).max(300)).catch([]),
  collection: z.uuid().nullable().default(null).catch(null),
  meal: z.enum(MEAL_SLOTS).nullable().default(null).catch(null),
});
export type CookFilters = z.infer<typeof cookFiltersSchema>;

export const logCookSchema = z.object({
  dishId: z.uuid(),
  mealSlot: z.enum(MEAL_SLOTS).nullable().default(null),
  source: z.enum(COOK_SOURCES).default("cook"),
  /** Kitchen items that ran out while cooking (PRD §3.4); removed from My kitchen. */
  finished: z.array(z.uuid()).max(50).default([]),
});

export const cookLogIdSchema = z.object({ id: z.uuid() });

export const rateDishSchema = z.object({
  dishId: z.uuid(),
  stars: z.number().int().min(1).max(5),
  review: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(1000, "noteTooLong").nullable(),
  ),
});
