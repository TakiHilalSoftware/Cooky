import "server-only";

import { z } from "zod";

import { EMAIL_TEMPLATES } from "@/server/notify/email/render";
import { PUSH_TEMPLATES, type PushTemplate } from "@/server/notify/push";

const pushTemplates = Object.keys(PUSH_TEMPLATES) as [PushTemplate, ...PushTemplate[]];

/** Ids only (ARCHITECTURE §5.11): realtime events never carry content. */
const realtimeEvent = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["message", "message_changed", "receipt", "typing"]), conversationId: z.uuid() }),
  z.object({ type: z.literal("friends") }),
]);

/** Every job the outbox can carry. Payloads are re-validated when drained. */
export const outboxJobSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("email"),
    payload: z.object({
      template: z.enum(EMAIL_TEMPLATES),
      userId: z.string().min(1),
      to: z.email(),
      // Contains a single-use token; scrubbed once delivered.
      url: z.url().optional(),
    }),
  }),
  z.object({
    kind: z.literal("backup_import"),
    payload: z.object({ importId: z.uuid() }),
  }),
  z.object({
    kind: z.literal("push"),
    payload: z.object({
      template: z.enum(pushTemplates),
      userId: z.string().min(1),
      // Display names only, e.g. who sent a message; never message text.
      params: z.record(z.string(), z.string().max(120)),
      // An in-app path the notification opens, e.g. /messages/{id}.
      url: z.string().startsWith("/").max(300),
    }),
  }),
  z.object({ kind: z.literal("data_export"), payload: z.object({ exportId: z.uuid() }) }),
  z.object({ kind: z.literal("stripe_cancel"), payload: z.object({ userId: z.string().min(1) }) }),
  z.object({
    kind: z.literal("account_purge"),
    payload: z.object({ userId: z.string().min(1), actorId: z.string().min(1).nullable() }),
  }),
  z.object({
    kind: z.literal("pusher"),
    payload: z.object({ userIds: z.array(z.string().min(1)).min(1).max(500), event: realtimeEvent }),
  }),
]);

export type OutboxJob = z.infer<typeof outboxJobSchema>;
