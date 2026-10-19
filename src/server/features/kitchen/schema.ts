// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

const itemName = z.string().trim().min(1, "ingredientNameRequired").max(80, "ingredientNameTooLong");

/** Add one or a few items (the add box, quick staples, Undo, onboarding). */
export const addPantryItemsSchema = z.object({
  names: z.array(itemName).min(1).max(40),
  staple: z.boolean().default(false),
});

export const pantryItemIdSchema = z.object({ id: z.uuid() });
export const setPantryStapleSchema = z.object({ id: z.uuid(), staple: z.boolean() });
