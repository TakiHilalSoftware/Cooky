"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { shoppingListMembers, shoppingLists, user } from "@/server/db/schema";
import { lockOwnList } from "@/server/features/shopping/queries";
import { hasFeature } from "@/server/quota/tries";

import { userAction } from "./_clients";

/** A household list is for a home, not a crowd. */
const MAX_MEMBERS = 6;

function refresh() {
  revalidatePath("/[locale]/shopping", "page");
}

/**
 * Invites someone to share the owner's list (Pro). The answer is the same
 * whether or not the email has a Cooky account, so addresses can't be probed;
 * the invite appears on the other person's shopping list.
 */
export const inviteToHousehold = userAction
  .metadata({ actionName: "inviteToHousehold" })
  .inputSchema(z.object({ email: z.email("emailInvalid").trim().toLowerCase().max(254, "emailTooLong") }))
  .action(async ({ parsedInput: { email }, ctx }) => {
    if (!(await hasFeature(ctx.user.id, "household_list"))) returnServerError<ActionErrorCode>("plan_required");
    const [invitee] = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`)
      .limit(1);
    if (invitee && invitee.id !== ctx.user.id) {
      await getDb().transaction(async (tx) => {
        const list = await lockOwnList(tx, ctx.user.id);
        const [{ value } = { value: 0 }] = await tx
          .select({ value: count() })
          .from(shoppingListMembers)
          .where(eq(shoppingListMembers.listId, list.id));
        if (value >= MAX_MEMBERS) returnServerError<ActionErrorCode>("conflict");
        await tx.insert(shoppingListMembers).values({ listId: list.id, userId: invitee.id }).onConflictDoNothing();
      });
    }
    refresh();
    return { sent: true };
  });

/** Accept or decline an invite. Joining one household leaves any other. */
export const respondToHouseholdInvite = userAction
  .metadata({ actionName: "respondToHouseholdInvite" })
  .inputSchema(z.object({ listId: z.uuid(), accept: z.boolean() }))
  .action(async ({ parsedInput: { listId, accept }, ctx }) => {
    const where = and(eq(shoppingListMembers.listId, listId), eq(shoppingListMembers.userId, ctx.user.id));
    const [invite] = await getDb().select().from(shoppingListMembers).where(where).limit(1);
    if (!invite) returnServerError<ActionErrorCode>("not_found");
    await getDb().transaction(async (tx) => {
      if (!accept) return void (await tx.delete(shoppingListMembers).where(where));
      await tx
        .delete(shoppingListMembers)
        .where(and(eq(shoppingListMembers.userId, ctx.user.id), eq(shoppingListMembers.status, "active")));
      await tx.update(shoppingListMembers).set({ status: "active" }).where(where);
    });
    refresh();
    return { accepted: accept };
  });

/** Back to your own list. */
export const leaveHousehold = userAction
  .metadata({ actionName: "leaveHousehold" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    await getDb()
      .delete(shoppingListMembers)
      .where(and(eq(shoppingListMembers.userId, ctx.user.id), eq(shoppingListMembers.status, "active")));
    refresh();
    return { left: true };
  });

/** The owner removes someone (or cancels an invite). */
export const removeHouseholdMember = userAction
  .metadata({ actionName: "removeHouseholdMember" })
  .inputSchema(z.object({ userId: z.string().min(1).max(64) }))
  .action(async ({ parsedInput: { userId }, ctx }) => {
    const [list] = await getDb()
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(eq(shoppingLists.ownerId, ctx.user.id));
    if (!list) returnServerError<ActionErrorCode>("not_found");
    const removed = await getDb()
      .delete(shoppingListMembers)
      .where(and(eq(shoppingListMembers.listId, list.id), eq(shoppingListMembers.userId, userId)))
      .returning({ userId: shoppingListMembers.userId });
    if (removed.length === 0) returnServerError<ActionErrorCode>("not_found");
    refresh();
    return { removed: true };
  });
