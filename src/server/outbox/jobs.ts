import "server-only";

import { z } from "zod";

import { EMAIL_TEMPLATES } from "@/server/notify/email/render";

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
]);

export type OutboxJob = z.infer<typeof outboxJobSchema>;
