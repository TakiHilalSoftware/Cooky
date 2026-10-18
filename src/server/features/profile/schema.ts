// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { ACCENTS, TEXT_SIZES, THEMES } from "@/lib/appearance";

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, "nameRequired").max(60, "nameTooLong"),
});

/** Any subset of the appearance choices; each change saves on its own. */
export const appearanceSchema = z
  .object({ accent: z.enum(ACCENTS), theme: z.enum(THEMES), textSize: z.enum(TEXT_SIZES) })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const localeSchema = z.object({ locale: z.enum(routing.locales) });
