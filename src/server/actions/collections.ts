"use server";

import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { collectionDishes, collections } from "@/server/db/schema";
import { findOwnCollection, loadCollectionAllowance } from "@/server/features/collections/queries";
import { lockCollections, nameTaken } from "@/server/features/collections/write";
import {
  collectionIdSchema,
  createCollectionSchema,
  renameCollectionSchema,
  setDishCollectionsSchema,
} from "@/server/features/collections/schema";
import { findOwnDish } from "@/server/features/dishes/policy";

import { userAction } from "./_clients";

function refresh() {
  revalidatePath("/[locale]/dishes", "layout");
}

/** A new collection, if the plan has room (`plan_limits.collections`); otherwise the upgrade sheet opens. */
export const createCollection = userAction
  .metadata({ actionName: "createCollection" })
  .inputSchema(createCollectionSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const created = await getDb().transaction(async (tx) => {
      await lockCollections(tx, ctx.user.id);
      if (!(await loadCollectionAllowance(ctx.user.id, tx)).canAdd) {
        returnServerError<ActionErrorCode>("quota_exceeded");
      }
      if (await nameTaken(tx, ctx.user.id, input.name)) returnServerError<ActionErrorCode>("conflict");
      const [row] = await tx
        .insert(collections)
        .values({
          userId: ctx.user.id,
          name: input.name,
          position: sql`(select coalesce(max(position), -1) + 1 from ${collections} where user_id = ${ctx.user.id})`,
        })
        .returning({ id: collections.id, name: collections.name });
      return row!;
    });
    refresh();
    return created;
  });

export const renameCollection = userAction
  .metadata({ actionName: "renameCollection" })
  .inputSchema(renameCollectionSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await getDb().transaction(async (tx) => {
      await lockCollections(tx, ctx.user.id);
      const collection = await findOwnCollection(ctx.user.id, input.id, tx);
      if (!collection) returnServerError<ActionErrorCode>("not_found");
      if (await nameTaken(tx, ctx.user.id, input.name, collection.id)) returnServerError<ActionErrorCode>("conflict");
      await tx.update(collections).set({ name: input.name }).where(eq(collections.id, collection.id));
    });
    refresh();
    return { id: input.id, name: input.name };
  });

/** Removes the collection (never its dishes) at once, with Undo (PRD §3.10). */
export const deleteCollection = userAction
  .metadata({ actionName: "deleteCollection" })
  .inputSchema(collectionIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const collection = await findOwnCollection(ctx.user.id, id);
    if (!collection) returnServerError<ActionErrorCode>("not_found");
    await getDb().update(collections).set({ deletedAt: new Date() }).where(eq(collections.id, collection.id));
    refresh();
    return { id: collection.id, name: collection.name };
  });

/** Undo for deleteCollection: back with its dishes, if the plan still has room and the name is free. */
export const restoreCollection = userAction
  .metadata({ actionName: "restoreCollection" })
  .inputSchema(collectionIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await lockCollections(tx, ctx.user.id);
      const [collection] = await tx
        .select({ id: collections.id, name: collections.name })
        .from(collections)
        .where(and(eq(collections.id, id), eq(collections.userId, ctx.user.id), isNotNull(collections.deletedAt)))
        .limit(1);
      if (!collection) returnServerError<ActionErrorCode>("not_found");
      if (!(await loadCollectionAllowance(ctx.user.id, tx)).canAdd) {
        returnServerError<ActionErrorCode>("quota_exceeded");
      }
      if (await nameTaken(tx, ctx.user.id, collection.name)) returnServerError<ActionErrorCode>("conflict");
      await tx.update(collections).set({ deletedAt: null }).where(eq(collections.id, collection.id));
    });
    refresh();
    return { id };
  });

/**
 * Puts a dish in exactly these collections. Only the caller's own dish and
 * collections count; ids that aren't theirs are refused.
 */
export const setDishCollections = userAction
  .metadata({ actionName: "setDishCollections" })
  .inputSchema(setDishCollectionsSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await getDb().transaction(async (tx) => {
      const dish = await findOwnDish(ctx.user.id, input.dishId, tx);
      if (!dish) returnServerError<ActionErrorCode>("not_found");
      const owned =
        input.collectionIds.length === 0
          ? []
          : await tx
              .select({ id: collections.id })
              .from(collections)
              .where(
                and(
                  inArray(collections.id, input.collectionIds),
                  eq(collections.userId, ctx.user.id),
                  isNull(collections.deletedAt),
                ),
              );
      if (owned.length !== input.collectionIds.length) returnServerError<ActionErrorCode>("not_found");

      const mine = tx.select({ id: collections.id }).from(collections).where(eq(collections.userId, ctx.user.id));
      await tx
        .delete(collectionDishes)
        .where(and(eq(collectionDishes.dishId, dish.id), inArray(collectionDishes.collectionId, mine)));
      if (owned.length > 0) {
        await tx.insert(collectionDishes).values(owned.map((c) => ({ collectionId: c.id, dishId: dish.id })));
      }
    });
    refresh();
    return { collectionIds: input.collectionIds };
  });
