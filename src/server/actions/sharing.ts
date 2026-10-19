"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import type { ActionErrorCode } from "@/lib/errors";
import { getDb, type Executor } from "@/server/db/client";
import { dishes, dishGroups, friendGroupMembers, friendGroups } from "@/server/db/schema";
import { findOwnDish } from "@/server/features/dishes/policy";
import { contentsFor, loadDishAllowance } from "@/server/features/dishes/queries";
import { lockDishCount, writeContents } from "@/server/features/dishes/write";
import { findViewableDish } from "@/server/features/social/policy";
import { loadFriendIds, loadGroupAllowance } from "@/server/features/social/queries";
import {
  copyDishSchema,
  createGroupSchema,
  dishSharingSchema,
  groupIdSchema,
  updateGroupSchema,
} from "@/server/features/social/schema";
import { logger } from "@/server/observability/logger";
import { copyPhoto } from "@/server/storage/photos";

import { userAction } from "./_clients";

function refresh() {
  revalidatePath("/[locale]", "layout");
}

/** Serialises group-count changes per person, so parallel creates can't pass the plan's cap. */
async function lockGroups(tx: Executor, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`friend_groups:${userId}`}, 0))`);
}

async function groupNameTaken(tx: Executor, ownerId: string, name: string, exceptId?: string) {
  const [row] = await tx
    .select({ id: friendGroups.id })
    .from(friendGroups)
    .where(
      and(
        eq(friendGroups.ownerId, ownerId),
        sql`lower(${friendGroups.name}) = lower(${name})`,
        exceptId ? ne(friendGroups.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Only current friends can be in a group; anyone else makes the request invalid. */
async function setMembers(tx: Executor, ownerId: string, groupId: string, memberIds: string[]) {
  if (memberIds.length > 0) {
    const friends = new Set((await loadFriendIds(ownerId, tx)).map((f) => f.id));
    if (!memberIds.every((id) => friends.has(id))) returnServerError<ActionErrorCode>("invalid");
  }
  await tx.delete(friendGroupMembers).where(eq(friendGroupMembers.groupId, groupId));
  if (memberIds.length > 0) {
    await tx.insert(friendGroupMembers).values(memberIds.map((memberId) => ({ groupId, memberId })));
  }
}

async function findOwnGroup(tx: Executor, ownerId: string, id: string) {
  const [group] = await tx
    .select({ id: friendGroups.id, name: friendGroups.name })
    .from(friendGroups)
    .where(and(eq(friendGroups.id, id), eq(friendGroups.ownerId, ownerId)))
    .limit(1);
  return group ?? null;
}

/** A private friend list (PRD §3.6), if the plan has room (`plan_limits.friend_groups`). */
export const createFriendGroup = userAction
  .metadata({ actionName: "createFriendGroup" })
  .inputSchema(createGroupSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const group = await getDb().transaction(async (tx) => {
      await lockGroups(tx, ctx.user.id);
      if (!(await loadGroupAllowance(ctx.user.id, tx)).canAdd) returnServerError<ActionErrorCode>("quota_exceeded");
      if (await groupNameTaken(tx, ctx.user.id, input.name)) returnServerError<ActionErrorCode>("conflict");
      const [row] = await tx
        .insert(friendGroups)
        .values({ ownerId: ctx.user.id, name: input.name })
        .returning({ id: friendGroups.id, name: friendGroups.name });
      await setMembers(tx, ctx.user.id, row!.id, input.memberIds);
      return row!;
    });
    refresh();
    return group;
  });

export const updateFriendGroup = userAction
  .metadata({ actionName: "updateFriendGroup" })
  .inputSchema(updateGroupSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await getDb().transaction(async (tx) => {
      await lockGroups(tx, ctx.user.id);
      const group = await findOwnGroup(tx, ctx.user.id, input.id);
      if (!group) returnServerError<ActionErrorCode>("not_found");
      if (await groupNameTaken(tx, ctx.user.id, input.name, group.id)) returnServerError<ActionErrorCode>("conflict");
      await tx.update(friendGroups).set({ name: input.name }).where(eq(friendGroups.id, group.id));
      await setMembers(tx, ctx.user.id, group.id, input.memberIds);
    });
    refresh();
    return { id: input.id, name: input.name };
  });

/**
 * Deleting a group is wide-impact (the UI confirms first): dishes shared only
 * with it become visible to nobody but their owner.
 */
export const deleteFriendGroup = userAction
  .metadata({ actionName: "deleteFriendGroup" })
  .inputSchema(groupIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const removed = await getDb()
      .delete(friendGroups)
      .where(and(eq(friendGroups.id, id), eq(friendGroups.ownerId, ctx.user.id)))
      .returning({ id: friendGroups.id });
    if (removed.length === 0) returnServerError<ActionErrorCode>("not_found");
    refresh();
    return { id };
  });

/** Who can see a dish: only me, all friends, or chosen groups of mine. */
export const setDishSharing = userAction
  .metadata({ actionName: "setDishSharing" })
  .inputSchema(dishSharingSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const groupIds = input.visibility === "groups" ? input.groupIds : [];
    if (input.visibility === "groups" && groupIds.length === 0) returnServerError<ActionErrorCode>("invalid");
    await getDb().transaction(async (tx) => {
      const dish = await findOwnDish(ctx.user.id, input.dishId, tx);
      if (!dish) returnServerError<ActionErrorCode>("not_found");
      if (groupIds.length > 0) {
        const owned = await tx
          .select({ id: friendGroups.id })
          .from(friendGroups)
          .where(and(inArray(friendGroups.id, groupIds), eq(friendGroups.ownerId, ctx.user.id)));
        if (owned.length !== groupIds.length) returnServerError<ActionErrorCode>("not_found");
      }
      await tx.update(dishes).set({ visibility: input.visibility }).where(eq(dishes.id, dish.id));
      await tx.delete(dishGroups).where(eq(dishGroups.dishId, dish.id));
      if (groupIds.length > 0)
        await tx.insert(dishGroups).values(groupIds.map((groupId) => ({ dishId: dish.id, groupId })));
    });
    refresh();
    return { visibility: input.visibility, groupIds };
  });

/**
 * "Copy to my dishes" from a friend (PRD §3.6): a private copy in the caller's
 * box, within their plan's dish cap. Rating the copy rates the original.
 */
export const copyFriendDish = userAction
  .metadata({ actionName: "copyFriendDish" })
  .inputSchema(copyDishSchema.extend({ locale: z.enum(routing.locales) }))
  .action(async ({ parsedInput: { dishId, locale }, ctx }) => {
    const found = await findViewableDish(ctx.user.id, dishId);
    if (!found) returnServerError<ActionErrorCode>("not_found");
    if (found.isOwner) returnServerError<ActionErrorCode>("invalid");
    const original = found.dish;
    const contents = await contentsFor(original, locale);
    const copy = await getDb().transaction(async (tx) => {
      await lockDishCount(tx, ctx.user.id);
      if (!(await loadDishAllowance(ctx.user.id, tx)).canAdd) returnServerError<ActionErrorCode>("quota_exceeded");
      const [row] = await tx
        .insert(dishes)
        .values({
          userId: ctx.user.id,
          name: contents.name,
          difficulty: original.difficulty,
          course: original.course,
          servings: original.servings,
          seasons: original.seasons,
          dietaryTags: original.dietaryTags,
          caloriesKcal: original.caloriesKcal,
          proteinG: original.proteinG,
          carbsG: original.carbsG,
          fatG: original.fatG,
          copiedFromDishId: original.id,
        })
        .returning({ id: dishes.id });
      await writeContents(tx, row!.id, { ingredients: contents.ingredients, steps: contents.steps });
      return row!;
    });
    // The photo is copied after the dish exists; a failure only means no photo.
    if (original.imageKey) {
      try {
        const imageKey = await copyPhoto(original.imageKey, ctx.user.id);
        await getDb().update(dishes).set({ imageKey }).where(eq(dishes.id, copy.id));
      } catch (err) {
        logger.warn({ err, dishId: copy.id }, "copying a friend's dish photo failed");
      }
    }
    revalidatePath("/[locale]/dishes", "layout");
    return { id: copy.id };
  });
