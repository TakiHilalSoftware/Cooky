import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { Executor } from "@/server/db/client";
import { friendGroupMembers, friendGroups, friendRequests, friendships, userBlocks } from "@/server/db/schema";

import { orderedPair } from "./policy";

/** Serialises changes between two people, so crossing requests or a block mid-accept can't interleave. */
export async function lockPair(tx: Executor, a: string, b: string) {
  const [x, y] = orderedPair(a, b);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`pair:${x}:${y}`}, 0))`);
}

/** Friends now; any requests between them are done. */
export async function makeFriends(tx: Executor, a: string, b: string) {
  const [userAId, userBId] = orderedPair(a, b);
  await tx.insert(friendships).values({ userAId, userBId }).onConflictDoNothing();
  await deleteRequestsBetween(tx, a, b);
}

export async function deleteRequestsBetween(tx: Executor, a: string, b: string) {
  await tx
    .delete(friendRequests)
    .where(
      or(
        and(eq(friendRequests.fromUserId, a), eq(friendRequests.toUserId, b)),
        and(eq(friendRequests.fromUserId, b), eq(friendRequests.toUserId, a)),
      ),
    );
}

/**
 * Ends a friendship (PRD §3.6): each leaves the other's groups, so dishes
 * shared with friends or groups stop showing at once. The chat stays, read-only.
 */
export async function endFriendship(tx: Executor, a: string, b: string) {
  const [userAId, userBId] = orderedPair(a, b);
  await tx.delete(friendships).where(and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)));
  const groupsOf = (owner: string) =>
    tx.select({ id: friendGroups.id }).from(friendGroups).where(eq(friendGroups.ownerId, owner));
  await tx
    .delete(friendGroupMembers)
    .where(
      or(
        and(inArray(friendGroupMembers.groupId, groupsOf(a)), eq(friendGroupMembers.memberId, b)),
        and(inArray(friendGroupMembers.groupId, groupsOf(b)), eq(friendGroupMembers.memberId, a)),
      ),
    );
}

/** A silent block: friendship, requests and group memberships between them end. */
export async function blockPerson(tx: Executor, blockerId: string, blockedId: string) {
  await endFriendship(tx, blockerId, blockedId);
  await deleteRequestsBetween(tx, blockerId, blockedId);
  await tx.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
}
