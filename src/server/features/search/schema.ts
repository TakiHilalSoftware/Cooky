// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";

/** PRD §3.5: search starts at two characters. */
export const searchSchema = z.object({
  q: z.string().trim().min(2).max(80),
  locale: z.enum(routing.locales),
});
