"use server";

import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb, type Executor } from "@/server/db/client";
import { conversationReads, conversations, dishes, messages } from "@/server/db/schema";
import {
  archiveConversationSchema,
  conversationIdSchema,
  editMessageSchema,
  messageIdSchema,
  sendMessageSchema,
} from "@/server/features/messages/schema";
import { canWrite, findOwnConversation, listAttachableDishes, sideOf } from "@/server/features/messages/queries";
import { dishVisibleToSql, orderedPair } from "@/server/features/social/policy";
import { loadBasics } from "@/server/features/social/queries";
import { personSchema } from "@/server/features/social/schema";
import { queuePush, queueRealtime } from "@/server/notify/queue";
import { drainSoon } from "@/server/outbox/enqueue";

import { userAction, userReadAction } from "./_clients";

/** Undo (6 s) plus slack for a slow connection; after that a deletion is final. */
const RESTORE_WINDOW_MS = 2 * 60 * 1000;

function refresh() {
  // The thread, the inbox and the unread dot in the shell.
  revalidatePath("/[locale]", "layout");
}

/** A conversation the caller is in and may still write to. */
async function writableConversation(tx: Executor, userId: string, conversationId: string) {
  const conversation = await findOwnConversation(userId, conversationId, tx);
  if (!conversation) returnServerError<ActionErrorCode>("not_found");
  const side = sideOf(conversation, userId);
  if (!(await canWrite(userId, side.otherId, tx))) returnServerError<ActionErrorCode>("forbidden");
  return { conversation, side };
}

/** The caller's own message, not deleted, in a chat they can still write to. */
async function ownMessage(tx: Executor, userId: string, messageId: string) {
  const [message] = await tx
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.senderId, userId)))
    .limit(1);
  if (!message) returnServerError<ActionErrorCode>("not_found");
  const { side } = await writableConversation(tx, userId, message.conversationId);
  return { message, otherId: side.otherId };
}

/** "Message" on a friend: the existing chat, or a new one. Friends only. */
export const openConversation = userAction
  .metadata({ actionName: "openConversation" })
  .inputSchema(personSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    if (userId === ctx.user.id || !(await canWrite(ctx.user.id, userId))) {
      returnServerError<ActionErrorCode>("forbidden");
    }
    const [userAId, userBId] = orderedPair(ctx.user.id, userId);
    await getDb().insert(conversations).values({ userAId, userBId }).onConflictDoNothing();
    const [row] = await getDb()
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.userAId, userAId), eq(conversations.userBId, userBId)))
      .limit(1);
    return { conversationId: row!.id };
  });

/**
 * Sends text and/or one of the caller's dishes as a card (only a dish the
 * friend can open). The recipient gets an ids-only realtime event and a push
 * with the sender's name, never the text.
 */
export const sendMessage = userAction
  .metadata({ actionName: "sendMessage" })
  .inputSchema(sendMessageSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const me = ctx.user.id;
    const sent = await getDb().transaction(async (tx) => {
      const { conversation, side } = await writableConversation(tx, me, input.conversationId);
      if (input.dishId) {
        const [dish] = await tx
          .select({ id: dishes.id })
          .from(dishes)
          .where(and(eq(dishes.id, input.dishId), eq(dishes.userId, me), dishVisibleToSql(side.otherId)))
          .limit(1);
        if (!dish) returnServerError<ActionErrorCode>("invalid");
      }
      const [row] = await tx
        .insert(messages)
        .values({ conversationId: conversation.id, senderId: me, content: input.content, dishId: input.dishId })
        .returning({ id: messages.id, createdAt: messages.createdAt });
      // A new message brings an archived chat back for both sides.
      await tx
        .update(conversations)
        .set({ lastMessageAt: row!.createdAt, archivedByA: false, archivedByB: false })
        .where(eq(conversations.id, conversation.id));
      await tx
        .insert(conversationReads)
        .values({ conversationId: conversation.id, userId: me, lastReadAt: row!.createdAt })
        .onConflictDoUpdate({
          target: [conversationReads.conversationId, conversationReads.userId],
          set: { lastReadAt: row!.createdAt },
        });
      await queueRealtime(tx, [side.otherId], { type: "message", conversationId: conversation.id });
      const name = (await loadBasics([me], tx)).get(me)?.displayName ?? "";
      await queuePush(tx, side.otherId, "message", { name }, `/messages/${conversation.id}`);
      return row!;
    });
    drainSoon();
    refresh();
    return { id: sent.id };
  });

export const editMessage = userAction
  .metadata({ actionName: "editMessage" })
  .inputSchema(editMessageSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await getDb().transaction(async (tx) => {
      const { message, otherId } = await ownMessage(tx, ctx.user.id, input.messageId);
      if (message.deletedAt) returnServerError<ActionErrorCode>("not_found");
      await tx
        .update(messages)
        .set({ content: input.content, editedAt: new Date() })
        .where(eq(messages.id, message.id));
      await queueRealtime(tx, [otherId, ctx.user.id], {
        type: "message_changed",
        conversationId: message.conversationId,
      });
    });
    drainSoon();
    refresh();
    return { id: input.messageId, content: input.content };
  });

/** Deletes at once with Undo (PRD §3.10); the text is wiped for good by the daily purge. */
export const deleteMessage = userAction
  .metadata({ actionName: "deleteMessage" })
  .inputSchema(messageIdSchema)
  .action(async ({ parsedInput: { messageId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const { message, otherId } = await ownMessage(tx, ctx.user.id, messageId);
      if (message.deletedAt) return;
      await tx.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, message.id));
      await queueRealtime(tx, [otherId, ctx.user.id], {
        type: "message_changed",
        conversationId: message.conversationId,
      });
    });
    drainSoon();
    refresh();
    return { id: messageId };
  });

/** Undo for deleteMessage, within a short window. */
export const restoreMessage = userAction
  .metadata({ actionName: "restoreMessage" })
  .inputSchema(messageIdSchema)
  .action(async ({ parsedInput: { messageId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const { message, otherId } = await ownMessage(tx, ctx.user.id, messageId);
      if (!message.deletedAt || Date.now() - message.deletedAt.getTime() > RESTORE_WINDOW_MS) {
        returnServerError<ActionErrorCode>("not_found");
      }
      await tx.update(messages).set({ deletedAt: null }).where(eq(messages.id, message.id));
      await queueRealtime(tx, [otherId, ctx.user.id], {
        type: "message_changed",
        conversationId: message.conversationId,
      });
    });
    drainSoon();
    refresh();
    return { id: messageId };
  });

/**
 * The caller has read the chat up to now: "seen" for the other side, and the
 * unread dot clears. Works on read-only chats too.
 */
export const markConversationRead = userAction
  .metadata({ actionName: "markConversationRead" })
  .inputSchema(conversationIdSchema)
  .action(async ({ parsedInput: { conversationId }, ctx }) => {
    const me = ctx.user.id;
    const conversation = await findOwnConversation(me, conversationId);
    if (!conversation) returnServerError<ActionErrorCode>("not_found");
    const { otherId } = sideOf(conversation, me);
    const now = new Date();
    const changed = await getDb().transaction(async (tx) => {
      const [previous] = await tx
        .select({ at: conversationReads.lastReadAt })
        .from(conversationReads)
        .where(and(eq(conversationReads.conversationId, conversation.id), eq(conversationReads.userId, me)))
        .limit(1);
      // Only news from the other side changes anything worth telling them about.
      const [unseen] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            ne(messages.senderId, me),
            previous ? gt(messages.createdAt, previous.at) : undefined,
          ),
        )
        .limit(1);
      await tx
        .insert(conversationReads)
        .values({ conversationId: conversation.id, userId: me, lastReadAt: now })
        .onConflictDoUpdate({
          target: [conversationReads.conversationId, conversationReads.userId],
          set: { lastReadAt: now },
        });
      await tx
        .update(messages)
        .set({ deliveredAt: now })
        .where(
          and(eq(messages.conversationId, conversation.id), ne(messages.senderId, me), isNull(messages.deliveredAt)),
        );
      if (unseen) await queueRealtime(tx, [otherId], { type: "receipt", conversationId: conversation.id });
      return Boolean(unseen);
    });
    if (changed) {
      drainSoon();
      refresh();
    }
    return { read: true };
  });

/** This device received new messages (the app was open): senders see "delivered". */
export const markMessagesDelivered = userAction
  .metadata({ actionName: "markMessagesDelivered" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const me = ctx.user.id;
    const mine = getDb()
      .select({ id: conversations.id })
      .from(conversations)
      .where(or(eq(conversations.userAId, me), eq(conversations.userBId, me)));
    const updated = await getDb().transaction(async (tx) => {
      const rows = await tx
        .update(messages)
        .set({ deliveredAt: new Date() })
        .where(and(sql`${messages.conversationId} in ${mine}`, ne(messages.senderId, me), isNull(messages.deliveredAt)))
        .returning({ conversationId: messages.conversationId, senderId: messages.senderId });
      const byConversation = new Map(rows.map((r) => [r.conversationId, r.senderId]));
      for (const [conversationId, senderId] of byConversation) {
        await queueRealtime(tx, [senderId], { type: "receipt", conversationId });
      }
      return byConversation.size;
    });
    if (updated > 0) drainSoon();
    return { updated };
  });

/** "Lina is typing…": an ids-only event, sent at most every few seconds by the composer. */
export const sendTyping = userAction
  .metadata({ actionName: "sendTyping" })
  .inputSchema(conversationIdSchema)
  .action(async ({ parsedInput: { conversationId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const { side } = await writableConversation(tx, ctx.user.id, conversationId);
      await queueRealtime(tx, [side.otherId], { type: "typing", conversationId });
    });
    drainSoon();
    return { sent: true };
  });

/** Archive or bring back, for the caller only. */
export const setConversationArchived = userAction
  .metadata({ actionName: "setConversationArchived" })
  .inputSchema(archiveConversationSchema)
  .action(async ({ parsedInput: { conversationId, archived }, ctx }) => {
    const conversation = await findOwnConversation(ctx.user.id, conversationId);
    if (!conversation) returnServerError<ActionErrorCode>("not_found");
    const { archivedColumn } = sideOf(conversation, ctx.user.id);
    await getDb()
      .update(conversations)
      .set({ [archivedColumn]: archived })
      .where(eq(conversations.id, conversation.id));
    refresh();
    return { archived };
  });

/**
 * "Delete conversation" for the caller only (the UI confirms first): what came
 * before now disappears for them; the other side keeps their copy.
 */
export const clearConversation = userAction
  .metadata({ actionName: "clearConversation" })
  .inputSchema(conversationIdSchema)
  .action(async ({ parsedInput: { conversationId }, ctx }) => {
    const conversation = await findOwnConversation(ctx.user.id, conversationId);
    if (!conversation) returnServerError<ActionErrorCode>("not_found");
    const { clearedColumn, archivedColumn } = sideOf(conversation, ctx.user.id);
    await getDb()
      .update(conversations)
      .set({ [clearedColumn]: new Date(), [archivedColumn]: false })
      .where(eq(conversations.id, conversation.id));
    refresh();
    return { cleared: true };
  });

/** The picker behind "Attach a dish": your dishes this friend can open. */
export const getAttachableDishes = userReadAction
  .metadata({ actionName: "getAttachableDishes" })
  .inputSchema(conversationIdSchema)
  .action(async ({ parsedInput: { conversationId }, ctx }) => {
    const conversation = await findOwnConversation(ctx.user.id, conversationId);
    if (!conversation) returnServerError<ActionErrorCode>("not_found");
    return { dishes: await listAttachableDishes(ctx.user.id, sideOf(conversation, ctx.user.id).otherId) };
  });

/** Who wrote: for the in-app toast when a message arrives on another page. */
export const getConversationSender = userReadAction
  .metadata({ actionName: "getConversationSender" })
  .inputSchema(conversationIdSchema)
  .action(async ({ parsedInput: { conversationId }, ctx }) => {
    const conversation = await findOwnConversation(ctx.user.id, conversationId);
    if (!conversation) returnServerError<ActionErrorCode>("not_found");
    const { otherId } = sideOf(conversation, ctx.user.id);
    return { name: (await loadBasics([otherId])).get(otherId)?.displayName ?? "" };
  });
