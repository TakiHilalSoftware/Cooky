"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { dishes, dishNotes, dishSources, favorites } from "@/server/db/schema";
import { findOwnDish } from "@/server/features/dishes/policy";
import { copyImportedPhoto } from "@/server/features/dishes/photo-copy";
import { dishValues, lockDishCount, writeContents } from "@/server/features/dishes/write";
import { loadDishAllowance } from "@/server/features/dishes/queries";
import {
  createDishSchema,
  dishIdSchema,
  dishNoteSchema,
  favoriteSchema,
  updateDishSchema,
} from "@/server/features/dishes/schema";

import { userAction } from "./_clients";

/** The box, every dish page and their edit forms. */
function refreshDishes() {
  revalidatePath("/[locale]/dishes", "layout");
}

/** Adds a dish if the plan has room (`plan_limits.dishes`); otherwise the upgrade sheet opens. */
export const createDish = userAction
  .metadata({ actionName: "createDish" })
  .inputSchema(createDishSchema)
  .action(async ({ parsedInput: { source, ...input }, ctx }) => {
    const id = await getDb().transaction(async (tx) => {
      await lockDishCount(tx, ctx.user.id);
      if (!(await loadDishAllowance(ctx.user.id, tx)).canAdd) returnServerError<ActionErrorCode>("quota_exceeded");
      const [dish] = await tx
        .insert(dishes)
        .values({ userId: ctx.user.id, ...dishValues(input) })
        .returning({ id: dishes.id });
      await writeContents(tx, dish!.id, input);
      if (source) await tx.insert(dishSources).values({ dishId: dish!.id, url: source.url, siteName: source.siteName });
      return dish!.id;
    });
    // Best effort: a photo that can't be fetched never stops the dish from saving.
    if (source?.imageUrl) await copyImportedPhoto(ctx.user.id, id, source.imageUrl);
    refreshDishes();
    return { id };
  });

/** Saves changes to the caller's own dish; paused while the box is over the plan's limit. */
export const updateDish = userAction
  .metadata({ actionName: "updateDish" })
  .inputSchema(updateDishSchema)
  .action(async ({ parsedInput: { id, ...input }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const dish = await findOwnDish(ctx.user.id, id, tx);
      if (!dish) returnServerError<ActionErrorCode>("not_found");
      if ((await loadDishAllowance(ctx.user.id, tx)).readOnly) returnServerError<ActionErrorCode>("quota_exceeded");
      // Edited: it's the person's own text now, no longer following the catalog's translations.
      await tx
        .update(dishes)
        .set({ ...dishValues(input), followsCatalog: false })
        .where(eq(dishes.id, dish.id));
      await writeContents(tx, dish.id, input);
    });
    refreshDishes();
    return { id };
  });

/**
 * Deletes at once and offers Undo (PRD §3.10): the dish is only marked, and
 * a job removes it for good a day later. Allowed even when over the limit.
 */
export const deleteDish = userAction
  .metadata({ actionName: "deleteDish" })
  .inputSchema(dishIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const dish = await findOwnDish(ctx.user.id, id);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    await getDb().update(dishes).set({ deletedAt: new Date() }).where(eq(dishes.id, dish.id));
    refreshDishes();
    return { id: dish.id, name: dish.name };
  });

/** Undo for deleteDish. The dish counts again, so the plan must still have room. */
export const restoreDish = userAction
  .metadata({ actionName: "restoreDish" })
  .inputSchema(dishIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await lockDishCount(tx, ctx.user.id);
      const [dish] = await tx
        .select({ id: dishes.id })
        .from(dishes)
        .where(and(eq(dishes.id, id), eq(dishes.userId, ctx.user.id), isNotNull(dishes.deletedAt)))
        .limit(1);
      if (!dish) returnServerError<ActionErrorCode>("not_found");
      if (!(await loadDishAllowance(ctx.user.id, tx)).canAdd) returnServerError<ActionErrorCode>("quota_exceeded");
      await tx.update(dishes).set({ deletedAt: null }).where(eq(dishes.id, dish.id));
    });
    refreshDishes();
    return { id };
  });

export const setFavorite = userAction
  .metadata({ actionName: "setFavorite" })
  .inputSchema(favoriteSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const dish = await findOwnDish(ctx.user.id, input.dishId);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    const db = getDb();
    if (input.favorite) {
      await db.insert(favorites).values({ userId: ctx.user.id, dishId: dish.id }).onConflictDoNothing();
    } else {
      await db.delete(favorites).where(and(eq(favorites.userId, ctx.user.id), eq(favorites.dishId, dish.id)));
    }
    refreshDishes();
    return { favorite: input.favorite };
  });

/** The private "my notes" field. Saving it empty removes it. */
export const saveDishNote = userAction
  .metadata({ actionName: "saveDishNote" })
  .inputSchema(dishNoteSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const dish = await findOwnDish(ctx.user.id, input.dishId);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    const db = getDb();
    const where = and(eq(dishNotes.dishId, dish.id), eq(dishNotes.userId, ctx.user.id));
    if (input.text === "") await db.delete(dishNotes).where(where);
    else {
      await db
        .insert(dishNotes)
        .values({ dishId: dish.id, userId: ctx.user.id, text: input.text })
        .onConflictDoUpdate({ target: [dishNotes.dishId, dishNotes.userId], set: { text: input.text } });
    }
    refreshDishes();
    return { text: input.text || null };
  });
