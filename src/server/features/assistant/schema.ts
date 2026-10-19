// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";

export const ASSISTANT_MESSAGE_MAX = 500;

export const askAssistantSchema = z.object({
  threadId: z.uuid().nullable().default(null),
  text: z.string().trim().min(1, "messageRequired").max(ASSISTANT_MESSAGE_MAX, "messageTooLong"),
  locale: z.enum(routing.locales),
});

export const threadIdSchema = z.object({ id: z.uuid() });
