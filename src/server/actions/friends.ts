"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import type { Relation } from "@/lib/social";
import { getDb, type Executor } from "@/server/db/client";
import { friendRequests, profiles, user, userBlocks } from "@/server/db/schema";
import { areFriends, isBlockedEitherWay } from "@/server/features/social/policy";
import { loadBasics, searchPeople as findPeople } from "@/server/features/social/queries";
import { personSchema, respondToRequestSchema, searchPeopleSchema } from "@/server/features/social/schema";
import { HOUR_MS, requestOutcome } from "@/server/features/social/service";
import { blockPerson, endFriendship, lockPair, makeFriends } from "@/server/features/social/write";
import { queuePush, queueRealtime } from "@/server/notify/queue";
import { drainSoon } from "@/server/outbox/enqueue";

import { userAction, userReadAction } from "./_clients";

function refresh() {
  // Friends, profiles, dish pages and the shell badges all read friendships.
  revalidatePath("/[locale]", "layout");
}

async function displayNameOf(userId: string, executor: Executor) {
  return (await loadBasics([userId], executor)).get(userId)?.displayName ?? "";
}

/** Someone the caller may reach: active, verified, not suspended, no block either way. */
async function reachable(tx: Executor, me: string, other: string) {
  if (me === other) return false;
  const [row] = await tx
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.id, other),
        eq(user.status, "active"),
        eq(user.emailVerified, true),
        sql`coalesce(${user.banned}, false) = false`,
      ),
    )
    .limit(1);
  return Boolean(row) && !(await isBlockedEitherWay(me, other, tx));
}

/** Friends become friends; the other side hears about it. */
async function acceptBetween(tx: Executor, me: string, requester: string) {
  await makeFriends(tx, me, requester);
  await queuePush(tx, requester, "friendAccepted", { name: await displayNameOf(me, tx) }, `/friends/${me}`);
  await queueRealtime(tx, [requester], { type: "friends" });
}

/** People search: display name or exact email (PRD §3.6). Read-only, so it uses the roomy typing burst. */
export const searchPeople = userReadAction
  .metadata({ actionName: "searchPeople" })
  .inputSchema(searchPeopleSchema)
  .action(async ({ parsedInput: { query }, ctx }) => ({ people: await findPeople(ctx.user.id, query) }));

/**
 * Sends a request (20 an hour). Blocked or unknown people look the same
 * ("not found"). If they had already asked, this accepts. A declined
 * request looks sent again and changes nothing for 30 days.
 */
export const sendFriendRequest = userAction
  .metadata({ actionName: "sendFriendRequest" })
  .inputSchema(personSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    const me = ctx.user.id;
    const relation = await getDb().transaction(async (tx): Promise<Relation> => {
      await lockPair(tx, me, userId);
      if (!(await reachable(tx, me, userId))) returnServerError<ActionErrorCode>("not_found");
      const [isFriend, [incoming], [outgoing], [sent]] = await Promise.all([
        areFriends(me, userId, tx),
        tx
          .select({ id: friendRequests.id })
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.fromUserId, userId),
              eq(friendRequests.toUserId, me),
              eq(friendRequests.status, "pending"),
            ),
          )
          .limit(1),
        tx
          .select()
          .from(friendRequests)
          .where(and(eq(friendRequests.fromUserId, me), eq(friendRequests.toUserId, userId)))
          .limit(1),
        tx
          .select({ n: count() })
          .from(friendRequests)
          .where(and(eq(friendRequests.fromUserId, me), gt(friendRequests.sentAt, new Date(Date.now() - HOUR_MS)))),
      ]);
      const outcome = requestOutcome({
        isFriend,
        incomingPending: Boolean(incoming),
        outgoing: outgoing
          ? { status: outgoing.status, sentAt: outgoing.sentAt, cancelled: outgoing.cancelledAt !== null }
          : null,
        sentInLastHour: sent?.n ?? 0,
        now: new Date(),
      });
      switch (outcome) {
        case "already_friends":
          return "friend";
        case "accept_theirs":
          await acceptBetween(tx, me, userId);
          return "friend";
        case "already_requested":
          // Withdrawn during the cooldown and asked again: back to "Requested", still nothing sent.
          if (outgoing?.cancelledAt) {
            await tx.update(friendRequests).set({ cancelledAt: null }).where(eq(friendRequests.id, outgoing.id));
          }
          return "outgoing";
        case "rate_limited":
          return returnServerError<ActionErrorCode>("rate_limited");
        case "send":
          await tx
            .insert(friendRequests)
            .values({ fromUserId: me, toUserId: userId })
            .onConflictDoUpdate({
              target: [friendRequests.fromUserId, friendRequests.toUserId],
              set: { status: "pending", sentAt: new Date(), cancelledAt: null },
            });
          await queuePush(tx, userId, "friendRequest", { name: await displayNameOf(me, tx) }, "/friends");
          await queueRealtime(tx, [userId], { type: "friends" });
          return "outgoing";
      }
    });
    drainSoon();
    refresh();
    return { relation };
  });

/** Withdraws the caller's request. A declined one keeps its cooldown, silently. */
export const cancelFriendRequest = userAction
  .metadata({ actionName: "cancelFriendRequest" })
  .inputSchema(personSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await lockPair(tx, ctx.user.id, userId);
      const mine = and(eq(friendRequests.fromUserId, ctx.user.id), eq(friendRequests.toUserId, userId));
      await tx.delete(friendRequests).where(and(mine, eq(friendRequests.status, "pending")));
      await tx
        .update(friendRequests)
        .set({ cancelledAt: new Date() })
        .where(and(mine, eq(friendRequests.status, "declined")));
    });
    refresh();
    return { relation: "none" as const };
  });

/** Accept, decline (the sender isn't told), or block straight from the request. */
export const respondToFriendRequest = userAction
  .metadata({ actionName: "respondToFriendRequest" })
  .inputSchema(respondToRequestSchema)
  .action(async ({ parsedInput: { requestId, response }, ctx }) => {
    const me = ctx.user.id;
    const [request] = await getDb()
      .select()
      .from(friendRequests)
      .where(
        and(eq(friendRequests.id, requestId), eq(friendRequests.toUserId, me), eq(friendRequests.status, "pending")),
      )
      .limit(1);
    if (!request) returnServerError<ActionErrorCode>("not_found");
    const from = request.fromUserId;
    await getDb().transaction(async (tx) => {
      await lockPair(tx, me, from);
      if (response === "block") return blockPerson(tx, me, from);
      if (response === "decline") {
        await tx.update(friendRequests).set({ status: "declined" }).where(eq(friendRequests.id, request.id));
        return;
      }
      if (await isBlockedEitherWay(me, from, tx)) returnServerError<ActionErrorCode>("not_found");
      await acceptBetween(tx, me, from);
    });
    drainSoon();
    refresh();
    return { response, userId: from };
  });

/** Shared dishes and groups end at once; the chat becomes read-only (PRD §3.6). */
export const unfriend = userAction
  .metadata({ actionName: "unfriend" })
  .inputSchema(personSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await lockPair(tx, ctx.user.id, userId);
      if (!(await areFriends(ctx.user.id, userId, tx))) returnServerError<ActionErrorCode>("not_found");
      await endFriendship(tx, ctx.user.id, userId);
    });
    refresh();
    return { relation: "none" as const };
  });

/** Silent: they aren't told, and can no longer find, add or message the caller. */
export const blockUser = userAction
  .metadata({ actionName: "blockUser" })
  .inputSchema(personSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    if (userId === ctx.user.id) returnServerError<ActionErrorCode>("invalid");
    await getDb().transaction(async (tx) => {
      await lockPair(tx, ctx.user.id, userId);
      const [exists] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
      if (!exists) returnServerError<ActionErrorCode>("not_found");
      await blockPerson(tx, ctx.user.id, userId);
    });
    refresh();
    return { blocked: true };
  });

/** Unblocking doesn't restore the friendship; they can be added again. */
export const unblockUser = userAction
  .metadata({ actionName: "unblockUser" })
  .inputSchema(personSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    const removed = await getDb()
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, ctx.user.id), eq(userBlocks.blockedId, userId)))
      .returning({ id: userBlocks.blockedId });
    if (removed.length === 0) returnServerError<ActionErrorCode>("not_found");
    refresh();
    return { blocked: false };
  });

/** Opening Friends clears the new-request badge (PRD §3.0). */
export const markFriendsSeen = userAction
  .metadata({ actionName: "markFriendsSeen" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const updated = await getDb()
      .update(profiles)
      .set({ friendsSeenAt: new Date() })
      .where(eq(profiles.userId, ctx.user.id))
      .returning({ at: profiles.friendsSeenAt });
    revalidatePath("/[locale]", "layout");
    return { seen: updated.length > 0 };
  });
