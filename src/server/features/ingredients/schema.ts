// Shared by the autocomplete action and the ingredient field.
import { z } from "zod";

import { routing } from "@/i18n/routing";

export const suggestIngredientsSchema = z.object({
  query: z.string().trim().max(60),
  locale: z.enum(routing.locales),
});
