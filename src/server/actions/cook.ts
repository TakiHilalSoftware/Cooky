"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { cookLog, dishRatings, pantryItems } from "@/server/db/schema";
import { cookLogIdSchema, logCookSchema, rateDishSchema } from "@/server/features/cook/schema";
import { findOwnDish } from "@/server/features/dishes/policy";
import { findViewableDish } from "@/server/features/social/policy";
import { requestToday } from "@/server/time";

import { userAction } from "./_clients";

/** Cook, the dish pages and the kitchen all show what was cooked. */
function refreshCooking() {
  revalidatePath("/[locale]", "layout");
}

/**
 * "Log it for today" (PRD §3.4): records the cook on the person's local day,
 * and removes kitchen items they say ran out. Undo deletes the entry.
 */
export const logCook = userAction
  .metadata({ actionName: "logCook" })
  .inputSchema(logCookSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const dish = await findOwnDish(ctx.user.id, input.dishId);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    const date = await requestToday();
    const entry = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(cookLog)
        .values({ userId: ctx.user.id, dishId: dish.id, date, mealSlot: input.mealSlot, source: input.source })
        .returning({ id: cookLog.id, dishId: cookLog.dishId, date: cookLog.date });
      if (input.finished.length > 0) {
        // Staples are "always have": they never run out here.
        await tx
          .delete(pantryItems)
          .where(
            and(
              eq(pantryItems.userId, ctx.user.id),
              inArray(pantryItems.id, input.finished),
              eq(pantryItems.isStaple, false),
            ),
          );
      }
      return row!;
    });
    refreshCooking();
    return entry;
  });

export const undoLogCook = userAction
  .metadata({ actionName: "undoLogCook" })
  .inputSchema(cookLogIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const [removed] = await getDb()
      .delete(cookLog)
      .where(and(eq(cookLog.id, id), eq(cookLog.userId, ctx.user.id)))
      .returning({ id: cookLog.id });
    if (!removed) returnServerError<ActionErrorCode>("not_found");
    refreshCooking();
    return removed;
  });

/** 1–5 stars and an optional review. Only after cooking the dish at least once (PRD §3.2). */
export const rateDish = userAction
  .metadata({ actionName: "rateDish" })
  .inputSchema(rateDishSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const dish = await findOwnDish(ctx.user.id, input.dishId);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    const [cooked] = await getDb()
      .select({ id: cookLog.id })
      .from(cookLog)
      .where(and(eq(cookLog.userId, ctx.user.id), eq(cookLog.dishId, dish.id)))
      .limit(1);
    if (!cooked) returnServerError<ActionErrorCode>("forbidden");
    // A copy of a friend's dish rates the original too (PRD §3.2), while they can still see it.
    const original = dish.copiedFromDishId ? await findViewableDish(ctx.user.id, dish.copiedFromDishId) : null;
    const rated = [dish.id, ...(original && !original.isOwner ? [original.dish.id] : [])];
    await getDb()
      .insert(dishRatings)
      .values(rated.map((dishId) => ({ userId: ctx.user.id, dishId, stars: input.stars, review: input.review })))
      .onConflictDoUpdate({
        target: [dishRatings.userId, dishRatings.dishId],
        set: { stars: sql`excluded.stars`, review: sql`excluded.review` },
      });
    refreshCooking();
    return { stars: input.stars, review: input.review };
  });
