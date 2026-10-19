import "server-only";

import { and, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";

import { initialsOf } from "@/lib/initials";
import { FRIEND_DISHES_PAGE_SIZE, type Relation } from "@/lib/social";
import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import {
  conversationReads,
  conversations,
  dishes,
  dishGroups,
  friendGroupMembers,
  friendGroups,
  friendRequests,
  friendships,
  messages,
  profiles,
  user,
  userBlocks,
} from "@/server/db/schema";
import { env } from "@/server/env";
import { pushConfigured } from "@/server/notify/push";
import { getEntitlement, limitFor } from "@/server/quota/entitlement";
import { smallPhotoUrl } from "@/server/storage/photos";

import type {
  BlockedPersonDto,
  DishSharingDto,
  FriendDto,
  FriendGroupDto,
  FriendProfileDto,
  FriendRequestDto,
  FriendsPageDto,
  GroupAllowanceDto,
  NotificationSettingsDto,
  PersonDto,
  SharedDishCardDto,
  SocialBadgesDto,
} from "./dto";
import { isBlockedEitherWay, isFriendSql, notBlockedSql, orderedPair, sharedWithSql } from "./policy";
import { DECLINE_COOLDOWN_MS, escapeLike, relationOf, type OutgoingRequest } from "./service";

type Basic = { id: string; displayName: string; initials: string; avatarUrl: string | null };

/** Names and photos for these people (display name, never the email). */
export async function loadBasics(ids: string[], executor: Executor = getDb()): Promise<Map<string, Basic>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await executor
    .select({ id: user.id, name: user.name, displayName: profiles.displayName, avatarKey: profiles.avatarKey })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, unique));
  const entries = await Promise.all(
    rows.map(async (r): Promise<[string, Basic]> => {
      const displayName = r.displayName ?? r.name;
      return [
        r.id,
        { id: r.id, displayName, initials: initialsOf(displayName), avatarUrl: await smallPhotoUrl(r.avatarKey) },
      ];
    }),
  );
  return new Map(entries);
}

/** Where each of these people stands with the viewer. */
export async function relationsFor(
  viewerId: string,
  ids: string[],
  executor: Executor = getDb(),
  now = new Date(),
): Promise<Map<string, Relation>> {
  const others = [...new Set(ids)].filter((id) => id !== viewerId);
  const result = new Map<string, Relation>(ids.includes(viewerId) ? [[viewerId, "self"]] : []);
  if (others.length === 0) return result;
  const [friendRows, requestRows] = await Promise.all([
    executor
      .select({ a: friendships.userAId, b: friendships.userBId })
      .from(friendships)
      .where(
        or(
          and(eq(friendships.userAId, viewerId), inArray(friendships.userBId, others)),
          and(eq(friendships.userBId, viewerId), inArray(friendships.userAId, others)),
        ),
      ),
    executor
      .select({
        from: friendRequests.fromUserId,
        to: friendRequests.toUserId,
        status: friendRequests.status,
        sentAt: friendRequests.sentAt,
        cancelledAt: friendRequests.cancelledAt,
      })
      .from(friendRequests)
      .where(
        or(
          and(eq(friendRequests.fromUserId, viewerId), inArray(friendRequests.toUserId, others)),
          and(
            eq(friendRequests.toUserId, viewerId),
            inArray(friendRequests.fromUserId, others),
            eq(friendRequests.status, "pending"),
          ),
        ),
      ),
  ]);
  const friends = new Set(friendRows.map((r) => (r.a === viewerId ? r.b : r.a)));
  for (const id of others) {
    const outgoingRow = requestRows.find((r) => r.from === viewerId && r.to === id);
    const outgoing: OutgoingRequest = outgoingRow
      ? { status: outgoingRow.status, sentAt: outgoingRow.sentAt, cancelled: outgoingRow.cancelledAt !== null }
      : null;
    result.set(
      id,
      relationOf(
        {
          isSelf: false,
          isFriend: friends.has(id),
          outgoing,
          incomingPending: requestRows.some((r) => r.from === id && r.to === viewerId),
        },
        now,
      ),
    );
  }
  return result;
}

/** Full person DTOs, in the order given (unknown ids dropped). */
export async function loadPeople(viewerId: string, ids: string[], executor: Executor = getDb()): Promise<PersonDto[]> {
  const [basics, relations] = await Promise.all([loadBasics(ids, executor), relationsFor(viewerId, ids, executor)]);
  return ids.flatMap((id) => {
    const basic = basics.get(id);
    return basic ? [{ ...basic, relation: relations.get(id) ?? "none" }] : [];
  });
}

/** The viewer's friends' ids, with when each friendship started. */
export async function loadFriendIds(userId: string, executor: Executor = getDb()) {
  const rows = await executor
    .select({ a: friendships.userAId, b: friendships.userBId, since: friendships.createdAt })
    .from(friendships)
    .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)));
  return rows.map((r) => ({ id: r.a === userId ? r.b : r.a, since: r.since }));
}

export async function loadGroupAllowance(userId: string, executor: Executor = getDb()): Promise<GroupAllowanceDto> {
  const [[row], { plan }] = await Promise.all([
    executor.select({ n: count() }).from(friendGroups).where(eq(friendGroups.ownerId, userId)),
    getEntitlement(userId),
  ]);
  const { limit } = await limitFor(plan, "friend_groups", executor);
  const n = row?.n ?? 0;
  return { count: n, limit, canAdd: limit === null || n < limit };
}

/** The owner's groups, with members who are still friends. */
export async function loadGroups(userId: string, executor: Executor = getDb()): Promise<FriendGroupDto[]> {
  const groups = await executor
    .select({ id: friendGroups.id, name: friendGroups.name })
    .from(friendGroups)
    .where(eq(friendGroups.ownerId, userId))
    .orderBy(friendGroups.createdAt);
  if (groups.length === 0) return [];
  const members = await executor
    .select({ groupId: friendGroupMembers.groupId, memberId: friendGroupMembers.memberId })
    .from(friendGroupMembers)
    .where(
      and(
        inArray(
          friendGroupMembers.groupId,
          groups.map((g) => g.id),
        ),
        isFriendSql(userId, friendGroupMembers.memberId),
      ),
    );
  return groups.map((g) => ({
    ...g,
    memberIds: members.filter((m) => m.groupId === g.id).map((m) => m.memberId),
  }));
}

/** Friends, requests both ways, and groups for the Friends page. */
export const getFriendsPage = cache(async (): Promise<FriendsPageDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const viewerId = session.user.id;
  const db = getDb();
  const [friendIds, requestRows, groups, groupAllowance] = await Promise.all([
    loadFriendIds(viewerId),
    db
      .select({
        id: friendRequests.id,
        from: friendRequests.fromUserId,
        to: friendRequests.toUserId,
        status: friendRequests.status,
        sentAt: friendRequests.sentAt,
      })
      .from(friendRequests)
      .where(
        or(
          and(eq(friendRequests.toUserId, viewerId), eq(friendRequests.status, "pending")),
          // A decline still reads as "Requested" to the sender during the cooldown.
          and(
            eq(friendRequests.fromUserId, viewerId),
            or(
              eq(friendRequests.status, "pending"),
              and(
                isNull(friendRequests.cancelledAt),
                gt(friendRequests.sentAt, new Date(Date.now() - DECLINE_COOLDOWN_MS)),
              ),
            ),
          ),
        ),
      )
      .orderBy(desc(friendRequests.sentAt)),
    loadGroups(viewerId),
    loadGroupAllowance(viewerId),
  ]);
  // A request from someone you've since blocked (or who blocked you) stays hidden.
  const blocked = await blockedEitherWay(viewerId);
  const visibleRequests = requestRows.filter((r) => !blocked.has(r.from === viewerId ? r.to : r.from));
  const people = await loadPeople(viewerId, [
    ...friendIds.map((f) => f.id),
    ...visibleRequests.map((r) => (r.from === viewerId ? r.to : r.from)),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));

  const friends: FriendDto[] = friendIds
    .flatMap((f) => {
      const person = byId.get(f.id);
      return person ? [{ ...person, since: f.since.toISOString() }] : [];
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const request = (other: string, r: (typeof requestRows)[number]): FriendRequestDto[] => {
    const person = byId.get(other);
    return person ? [{ id: r.id, person, sentAt: r.sentAt.toISOString() }] : [];
  };
  return {
    friends,
    incoming: visibleRequests.filter((r) => r.to === viewerId).flatMap((r) => request(r.from, r)),
    outgoing: visibleRequests.filter((r) => r.from === viewerId).flatMap((r) => request(r.to, r)),
    groups,
    groupAllowance,
  };
});

async function blockedEitherWay(userId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ blocker: userBlocks.blockerId, blocked: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
  return new Set(rows.map((r) => (r.blocker === userId ? r.blocked : r.blocker)));
}

/**
 * People search (PRD §3.6): by display name (typo-tolerant), or by an exact
 * email only, so addresses are never revealed. Blocked people either way,
 * suspended and unverified accounts never appear.
 */
export async function searchPeople(viewerId: string, query: string): Promise<PersonDto[]> {
  const q = query.trim();
  const byEmail = q.includes("@");
  const rows = await getDb()
    .select({ id: user.id })
    .from(user)
    .innerJoin(profiles, eq(profiles.userId, user.id))
    .where(
      and(
        sql`${user.id} <> ${viewerId}`,
        eq(user.status, "active"),
        sql`coalesce(${user.banned}, false) = false`,
        eq(user.emailVerified, true),
        notBlockedSql(viewerId, user.id),
        byEmail
          ? sql`lower(${user.email}) = ${q.toLowerCase()}`
          : or(
              sql`${profiles.displayName} ilike ${`%${escapeLike(q)}%`}`,
              sql`similarity(${profiles.displayName}, ${q}) > 0.3`,
            ),
      ),
    )
    .orderBy(byEmail ? user.id : sql`similarity(${profiles.displayName}, ${q}) desc`)
    .limit(20);
  return loadPeople(
    viewerId,
    rows.map((r) => r.id),
  );
}

/** Dishes the owner shared with the viewer, newest first. */
async function sharedDishesOf(viewerId: string, ownerId: string, page: number) {
  const where = and(eq(dishes.userId, ownerId), sharedWithSql(viewerId));
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({
        id: dishes.id,
        name: dishes.name,
        course: dishes.course,
        difficulty: dishes.difficulty,
        servings: dishes.servings,
        imageKey: dishes.imageKey,
      })
      .from(dishes)
      .where(where)
      .orderBy(desc(dishes.createdAt), desc(dishes.id))
      .limit(FRIEND_DISHES_PAGE_SIZE + 1)
      .offset((page - 1) * FRIEND_DISHES_PAGE_SIZE),
    getDb().select({ n: count() }).from(dishes).where(where),
  ]);
  const cards: SharedDishCardDto[] = await Promise.all(
    rows.slice(0, FRIEND_DISHES_PAGE_SIZE).map(async ({ imageKey, ...d }) => ({
      ...d,
      photoUrl: await smallPhotoUrl(imageKey),
    })),
  );
  return { cards, hasMore: rows.length > FRIEND_DISHES_PAGE_SIZE, total: total?.n ?? 0 };
}

/**
 * Someone's profile as the viewer sees it. Blocked either way, suspended or
 * unknown: null (a plain "not found"). Non-friends see a name and an
 * "Add friend" button, and no dishes.
 */
export const getFriendProfile = cache(async (personId: string, page: number): Promise<FriendProfileDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const viewerId = session.user.id;
  if (personId === viewerId) return null;
  const [target] = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, personId), eq(user.status, "active"), sql`coalesce(${user.banned}, false) = false`))
    .limit(1);
  if (!target || (await isBlockedEitherWay(viewerId, personId))) return null;

  const [userAId, userBId] = orderedPair(viewerId, personId);
  const [[person], [friendship], shared, [conversation]] = await Promise.all([
    loadPeople(viewerId, [personId]),
    getDb()
      .select({ since: friendships.createdAt })
      .from(friendships)
      .where(and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)))
      .limit(1),
    sharedDishesOf(viewerId, personId, page),
    getDb()
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.userAId, userAId), eq(conversations.userBId, userBId)))
      .limit(1),
  ]);
  if (!person) return null;
  return {
    person,
    since: friendship?.since.toISOString() ?? null,
    dishes: shared.cards,
    page,
    hasMore: shared.hasMore,
    sharedCount: shared.total,
    conversationId: conversation?.id ?? null,
  };
});

/** People the viewer blocked, for Settings (unblock there). */
export const getBlockedPeople = cache(async (): Promise<BlockedPersonDto[] | null> => {
  const session = await getSession();
  if (!session) return null;
  const rows = await getDb()
    .select({ id: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, session.user.id))
    .orderBy(desc(userBlocks.createdAt));
  const basics = await loadBasics(rows.map((r) => r.id));
  return rows.flatMap((r) => {
    const basic = basics.get(r.id);
    return basic ? [basic] : [];
  });
});

/** The Friends badge and the messages dot, for the app shell. */
export const getSocialBadges = cache(async (): Promise<SocialBadgesDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const viewerId = session.user.id;
  const db = getDb();
  const [profile] = await db
    .select({ seenAt: profiles.friendsSeenAt })
    .from(profiles)
    .where(eq(profiles.userId, viewerId))
    .limit(1);
  const [[requests], [unread]] = await Promise.all([
    db
      .select({ n: count() })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.toUserId, viewerId),
          eq(friendRequests.status, "pending"),
          profile?.seenAt ? gt(friendRequests.sentAt, profile.seenAt) : undefined,
          notBlockedSql(viewerId, friendRequests.fromUserId),
        ),
      ),
    db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .leftJoin(
        conversationReads,
        and(eq(conversationReads.conversationId, conversations.id), eq(conversationReads.userId, viewerId)),
      )
      .where(
        and(
          or(eq(conversations.userAId, viewerId), eq(conversations.userBId, viewerId)),
          sql`${messages.senderId} <> ${viewerId}`,
          isNull(messages.deletedAt),
          sql`${messages.createdAt} > coalesce(${conversationReads.lastReadAt}, 'epoch'::timestamptz)`,
          sql`${messages.createdAt} > coalesce(case when ${conversations.userAId} = ${viewerId} then ${conversations.clearedAtA} else ${conversations.clearedAtB} end, 'epoch'::timestamptz)`,
        ),
      )
      .limit(1),
  ]);
  return { newRequests: requests?.n ?? 0, unreadMessages: Boolean(unread) };
});

/** How the owner shares a dish, with their groups (and member counts) to choose from. */
export async function loadDishSharing(
  ownerId: string,
  dish: { id: string; visibility: DishSharingDto["visibility"] },
): Promise<DishSharingDto> {
  const [groups, chosen, friendIds] = await Promise.all([
    loadGroups(ownerId),
    getDb().select({ groupId: dishGroups.groupId }).from(dishGroups).where(eq(dishGroups.dishId, dish.id)),
    loadFriendIds(ownerId),
  ]);
  return {
    visibility: dish.visibility,
    groupIds: chosen.map((c) => c.groupId),
    groups: groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberIds.length })),
    friendCount: friendIds.length,
  };
}

export const getNotificationSettings = cache(async (): Promise<NotificationSettingsDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const [profile] = await getDb()
    .select({ off: profiles.notificationsOff })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);
  return {
    off: profile?.off ?? [],
    vapidPublicKey: pushConfigured() ? (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null) : null,
  };
});
