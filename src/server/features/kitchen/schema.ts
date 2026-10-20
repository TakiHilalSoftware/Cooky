// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";

const itemName = z.string().trim().min(1, "ingredientNameRequired").max(80, "ingredientNameTooLong");

/** The language the kitchen is shown in: every write returns the updated kitchen, named for the page. */
const locale = z.enum(routing.locales).default(routing.defaultLocale);

/** Add one or a few items (the add box, quick staples, Undo, "I have it"). */
export const addPantryItemsSchema = z.object({
  names: z.array(itemName).min(1).max(40),
  staple: z.boolean().default(false),
  locale,
});

export const pantryItemIdSchema = z.object({ id: z.uuid(), locale });
export const setPantryStapleSchema = z.object({ id: z.uuid(), staple: z.boolean(), locale });
/** The read-only kitchen lookups (the kitchen itself, "Ready to cook"). */
export const kitchenReadSchema = z.object({ locale });
