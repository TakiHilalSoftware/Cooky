import "server-only";

import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDb, type Executor } from "@/server/db/client";
import { dishes, dishGroups, friendGroupMembers, friendGroups, friendships, userBlocks } from "@/server/db/schema";

// Who may see whom and what (PRD §3.6, ARCHITECTURE §4.5). Every social read
// and write goes through these rules; nothing else decides friendship,
// blocking or dish sharing.

/** A pair stored once, smaller id first (friendships, conversations). */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** SQL: `other` is a friend of `userId`. */
export function isFriendSql(userId: string, other: AnyPgColumn | SQL): SQL {
  return sql`exists (select 1 from ${friendships} f where f.user_a_id = least(${userId}, ${other}) and f.user_b_id = greatest(${userId}, ${other}))`;
}

/** SQL: no block between `userId` and `other`, in either direction. */
export function notBlockedSql(userId: string, other: AnyPgColumn | SQL): SQL {
  return sql`not exists (select 1 from ${userBlocks} b where (b.blocker_id = ${userId} and b.blocked_id = ${other}) or (b.blocker_id = ${other} and b.blocked_id = ${userId}))`;
}

export async function areFriends(a: string, b: string, executor: Executor = getDb()): Promise<boolean> {
  const [userAId, userBId] = orderedPair(a, b);
  const [row] = await executor
    .select({ a: friendships.userAId })
    .from(friendships)
    .where(and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)))
    .limit(1);
  return Boolean(row);
}

export async function isBlockedEitherWay(a: string, b: string, executor: Executor = getDb()): Promise<boolean> {
  const [row] = await executor
    .select({ a: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * SQL over `dishes`: the viewer may open this dish. Their own, or a current
 * friend's (no block either way) shared with all friends, or with a group of
 * the owner's that the viewer is in. Deleted dishes never count.
 */
export function dishVisibleToSql(viewerId: string): SQL {
  // Qualified by hand: in a one-table query Drizzle leaves columns bare, and a
  // bare "id" here would mean friend_groups.id.
  const outer = (column: "id" | "user_id") => sql`${dishes}.${sql.identifier(column)}`;
  const inSharedGroup = sql`exists (
    select 1 from ${dishGroups} dg
    join ${friendGroups} g on g.id = dg.group_id and g.owner_id = ${outer("user_id")}
    join ${friendGroupMembers} m on m.group_id = g.id and m.member_id = ${viewerId}
    where dg.dish_id = ${outer("id")})`;
  return and(
    isNull(dishes.deletedAt),
    or(
      eq(dishes.userId, viewerId),
      and(
        isFriendSql(viewerId, dishes.userId),
        notBlockedSql(viewerId, dishes.userId),
        or(eq(dishes.visibility, "friends"), and(eq(dishes.visibility, "groups"), inSharedGroup)),
      ),
    ),
  )!;
}

/** SQL over `dishes`: shared with the viewer by someone else (never the viewer's own). */
export function sharedWithSql(viewerId: string): SQL {
  return and(sql`${dishes.userId} <> ${viewerId}`, dishVisibleToSql(viewerId))!;
}

/**
 * A dish the viewer may open, with whether it's theirs. Someone else's
 * private dish and a missing one look the same, so ids can't be probed.
 */
export async function findViewableDish(viewerId: string, dishId: string, executor: Executor = getDb()) {
  const [dish] = await executor
    .select()
    .from(dishes)
    .where(and(eq(dishes.id, dishId), dishVisibleToSql(viewerId)))
    .limit(1);
  return dish ? { dish, isOwner: dish.userId === viewerId } : null;
}
