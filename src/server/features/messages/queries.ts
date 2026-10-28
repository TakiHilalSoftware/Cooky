import "server-only";

import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import { catalogDishes, conversationReads, conversations, dishes, messages } from "@/server/db/schema";
import { areFriends, dishVisibleToSql, isBlockedEitherWay } from "@/server/features/social/policy";
import { loadPeople } from "@/server/features/social/queries";
import type { SharedDishCardDto } from "@/server/features/social/dto";
import { dishSmallPhotoUrl } from "@/server/features/dishes/photo";

import type {
  AttachableDishDto,
  ConversationListDto,
  ConversationSummaryDto,
  MessageDishDto,
  MessageDto,
  ThreadDto,
} from "./dto";

type ConversationRow = typeof conversations.$inferSelect;

/** The caller's side of a conversation: which columns are theirs, and who the other person is. */
export function sideOf(conversation: ConversationRow, userId: string) {
  const isA = conversation.userAId === userId;
  return {
    otherId: isA ? conversation.userBId : conversation.userAId,
    archived: isA ? conversation.archivedByA : conversation.archivedByB,
    clearedAt: isA ? conversation.clearedAtA : conversation.clearedAtB,
    archivedColumn: isA ? ("archivedByA" as const) : ("archivedByB" as const),
    clearedColumn: isA ? ("clearedAtA" as const) : ("clearedAtB" as const),
    otherArchivedColumn: isA ? ("archivedByB" as const) : ("archivedByA" as const),
  };
}

/** A conversation the caller is part of, or null (someone else's looks missing). */
export async function findOwnConversation(userId: string, conversationId: string, executor: Executor = getDb()) {
  const [row] = await executor
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Writing needs a current friendship and no block either way; otherwise the chat is read-only. */
export async function canWrite(userId: string, otherId: string, executor: Executor = getDb()): Promise<boolean> {
  const [friends, blocked] = await Promise.all([
    areFriends(userId, otherId, executor),
    isBlockedEitherWay(userId, otherId, executor),
  ]);
  return friends && !blocked;
}

const PREVIEW_CHARS = 120;

/** The inbox: newest first, each side's archive and clear respected. */
export const getConversations = cache(async (showArchived: boolean): Promise<ConversationListDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const me = session.user.id;
  const db = getDb();
  const mine = or(eq(conversations.userAId, me), eq(conversations.userBId, me));
  const myArchived = sql<boolean>`case when ${conversations.userAId} = ${me} then ${conversations.archivedByA} else ${conversations.archivedByB} end`;
  const myCleared = sql`coalesce(case when ${conversations.userAId} = ${me} then ${conversations.clearedAtA} else ${conversations.clearedAtB} end, 'epoch'::timestamptz)`;
  // Only chats with something to show since the caller last cleared them.
  const hasMessages = sql`${conversations.lastMessageAt} > ${myCleared}`;

  const [rows, [archived]] = await Promise.all([
    db
      .select()
      .from(conversations)
      .where(and(mine, hasMessages, showArchived ? sql`${myArchived}` : sql`not ${myArchived}`))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(200),
    db
      .select({ n: count() })
      .from(conversations)
      .where(and(mine, hasMessages, sql`${myArchived}`)),
  ]);
  if (rows.length === 0) return { conversations: [], archivedCount: archived?.n ?? 0, showingArchived: showArchived };

  const ids = rows.map((r) => r.id);
  const [lastRows, reads] = await Promise.all([
    // The newest visible message per conversation.
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        content: messages.content,
        dishId: messages.dishId,
        deletedAt: messages.deletedAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .orderBy(messages.conversationId, desc(messages.createdAt), desc(messages.id)),
    db
      .select({ conversationId: conversationReads.conversationId, lastReadAt: conversationReads.lastReadAt })
      .from(conversationReads)
      .where(and(inArray(conversationReads.conversationId, ids), eq(conversationReads.userId, me))),
  ]);
  const people = await loadPeople(
    me,
    rows.map((r) => sideOf(r, me).otherId),
  );
  const personById = new Map(people.map((p) => [p.id, p]));

  const summaries: ConversationSummaryDto[] = rows.flatMap((row) => {
    const side = sideOf(row, me);
    const person = personById.get(side.otherId);
    if (!person) return [];
    const last = lastRows.find((m) => m.conversationId === row.id);
    const visible = last && (!side.clearedAt || last.createdAt > side.clearedAt) ? last : null;
    const readAt = reads.find((r) => r.conversationId === row.id)?.lastReadAt;
    return [
      {
        id: row.id,
        person,
        archived: side.archived,
        unread: Boolean(
          visible && visible.senderId !== me && !visible.deletedAt && (!readAt || visible.createdAt > readAt),
        ),
        last: visible
          ? {
              kind: visible.deletedAt ? "deleted" : visible.content ? "text" : "dish",
              text: visible.deletedAt || !visible.content ? null : visible.content.slice(0, PREVIEW_CHARS),
              fromMe: visible.senderId === me,
              at: visible.createdAt.toISOString(),
            }
          : null,
      },
    ];
  });
  return { conversations: summaries, archivedCount: archived?.n ?? 0, showingArchived: showArchived };
});

/** Dish cards in messages, re-checked for the reader: a dish no longer shared shows as unavailable. */
async function loadMessageDishes(readerId: string, dishIds: string[]): Promise<Map<string, MessageDishDto>> {
  const unique = [...new Set(dishIds)];
  if (unique.length === 0) return new Map();
  const rows = await getDb()
    .select({
      id: dishes.id,
      name: dishes.name,
      course: dishes.course,
      imageKey: dishes.imageKey,
      catalogPhotoUrl: catalogDishes.photoUrl,
      visible: sql<boolean>`${dishVisibleToSql(readerId)}`,
    })
    .from(dishes)
    .leftJoin(catalogDishes, eq(catalogDishes.id, dishes.catalogDishId))
    .where(inArray(dishes.id, unique));
  const entries = await Promise.all(
    rows.map(async (d): Promise<[string, MessageDishDto]> => [
      d.id,
      {
        id: d.id,
        // Nothing about a dish the reader can't open, beyond that it was one.
        name: d.visible ? d.name : "",
        course: d.course,
        photoUrl: d.visible ? await dishSmallPhotoUrl(d) : null,
        available: d.visible,
      },
    ]),
  );
  return new Map(entries);
}

/** One conversation, the latest `limit` messages, oldest first. */
export const getThread = cache(async (conversationId: string, limit: number): Promise<ThreadDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const me = session.user.id;
  const conversation = await findOwnConversation(me, conversationId);
  if (!conversation) return null;
  const side = sideOf(conversation, me);
  const db = getDb();

  const [rows, [otherRead], [person], writable, shared] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          side.clearedAt ? sql`${messages.createdAt} > ${side.clearedAt}` : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1),
    db
      .select({ lastReadAt: conversationReads.lastReadAt })
      .from(conversationReads)
      .where(and(eq(conversationReads.conversationId, conversation.id), eq(conversationReads.userId, side.otherId)))
      .limit(1),
    loadPeople(me, [side.otherId]),
    canWrite(me, side.otherId),
    sharedDishPreview(me, side.otherId),
  ]);
  if (!person) return null;
  const page = rows.slice(0, limit).reverse();
  const dishById = await loadMessageDishes(
    me,
    page.flatMap((m) => (m.dishId && !m.deletedAt ? [m.dishId] : [])),
  );
  const seenUntil = otherRead?.lastReadAt ?? null;

  return {
    id: conversation.id,
    person,
    limit,
    hasEarlier: rows.length > limit,
    canSend: writable,
    archived: side.archived,
    sharedDishes: shared,
    messages: page.map((m): MessageDto => {
      const fromMe = m.senderId === me;
      const deleted = m.deletedAt !== null;
      return {
        id: m.id,
        fromMe,
        text: deleted ? null : m.content || null,
        deleted,
        edited: m.editedAt !== null && !deleted,
        at: m.createdAt.toISOString(),
        dish: !deleted && m.dishId ? (dishById.get(m.dishId) ?? null) : null,
        status: !fromMe ? null : seenUntil && seenUntil >= m.createdAt ? "seen" : m.deliveredAt ? "delivered" : "sent",
      };
    }),
  };
});

/** Up to three dishes the other person shared with the viewer (profile popup). */
async function sharedDishPreview(viewerId: string, ownerId: string): Promise<SharedDishCardDto[]> {
  const rows = await getDb()
    .select({
      id: dishes.id,
      name: dishes.name,
      course: dishes.course,
      difficulty: dishes.difficulty,
      servings: dishes.servings,
      imageKey: dishes.imageKey,
      catalogPhotoUrl: catalogDishes.photoUrl,
    })
    .from(dishes)
    .leftJoin(catalogDishes, eq(catalogDishes.id, dishes.catalogDishId))
    .where(and(eq(dishes.userId, ownerId), dishVisibleToSql(viewerId)))
    .orderBy(desc(dishes.createdAt))
    .limit(3);
  return Promise.all(
    rows.map(async ({ imageKey, catalogPhotoUrl, ...d }) => ({
      ...d,
      photoUrl: await dishSmallPhotoUrl({ imageKey, catalogPhotoUrl }),
    })),
  );
}

/** The caller's dishes the friend can open: only those can go in a message. */
export async function listAttachableDishes(ownerId: string, friendId: string): Promise<AttachableDishDto[]> {
  const rows = await getDb()
    .select({
      id: dishes.id,
      name: dishes.name,
      course: dishes.course,
      imageKey: dishes.imageKey,
      catalogPhotoUrl: catalogDishes.photoUrl,
    })
    .from(dishes)
    .leftJoin(catalogDishes, eq(catalogDishes.id, dishes.catalogDishId))
    .where(and(eq(dishes.userId, ownerId), isNull(dishes.deletedAt), dishVisibleToSql(friendId)))
    .orderBy(dishes.name)
    .limit(200);
  return Promise.all(
    rows.map(async ({ imageKey, catalogPhotoUrl, ...d }) => ({
      ...d,
      photoUrl: await dishSmallPhotoUrl({ imageKey, catalogPhotoUrl }),
    })),
  );
}
