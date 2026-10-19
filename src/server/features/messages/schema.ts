// Shared by the message actions (authoritative) and the composer (hints).
import { z } from "zod";

import { MESSAGE_MAX } from "@/lib/social";

export const conversationIdSchema = z.object({ conversationId: z.uuid() });
export const messageIdSchema = z.object({ messageId: z.uuid() });

const content = z.string().trim().max(MESSAGE_MAX, "messageTooLong");

/** Text, a dish card, or both; never nothing. */
export const sendMessageSchema = z
  .object({ conversationId: z.uuid(), content, dishId: z.uuid().optional() })
  .refine((m) => m.content.length > 0 || m.dishId, { message: "messageRequired", path: ["content"] });

export const editMessageSchema = z.object({ messageId: z.uuid(), content: content.min(1, "messageRequired") });

export const archiveConversationSchema = z.object({ conversationId: z.uuid(), archived: z.boolean() });

/** How many recent messages the thread shows: 50 more each time (PRD §3.6). */
export const threadLimitSchema = z.coerce.number().int().min(50).max(2000).catch(50);
