// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { DISH_BOUNDS, UNITS } from "@/lib/dishes";
import { daySchema } from "@/server/features/planner/schema";

/** What to shop for: one dish (optionally scaled), an event's menu, or a planner week. */
export const addToShoppingSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("dish"),
    id: z.uuid(),
    servings: z.number().int().min(DISH_BOUNDS.servingsMin).max(DISH_BOUNDS.servingsMax).optional(),
  }),
  z.object({ source: z.literal("event"), id: z.uuid() }),
  z.object({ source: z.literal("week"), weekStart: daySchema }),
]);

export const manualItemSchema = z.object({
  name: z.string().trim().min(1, "ingredientNameRequired").max(80, "ingredientNameTooLong"),
});

export const toggleShoppingItemSchema = z.object({
  id: z.uuid(),
  checked: z.boolean(),
  /** When the tick happened on the device: an older replay never overwrites a newer change. */
  at: z.iso.datetime(),
});
export const shoppingItemIdSchema = z.object({ id: z.uuid() });
export const restoreShoppingItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.number().min(0).max(DISH_BOUNDS.amountMax).nullable(),
  unit: z.enum(UNITS).nullable(),
  manual: z.boolean(),
  checked: z.boolean(),
});
export const clearShoppingSchema = z.object({ scope: z.enum(["checked", "all"]) });
export const doneShoppingSchema = z.object({ addToKitchen: z.boolean() });
