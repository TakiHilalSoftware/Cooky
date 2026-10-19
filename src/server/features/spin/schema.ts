// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { SPIN_MODES } from "@/lib/dishes";

export const spinSchema = z.object({
  mode: z.enum(SPIN_MODES),
  /** "With my ingredients": up to 10 (PRD §3.4). Ignored in random mode. */
  ingredients: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  collectionId: z.uuid().nullable().default(null),
  locale: z.enum(routing.locales),
});
