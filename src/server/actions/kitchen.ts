"use server";

import { and, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { pantryItems } from "@/server/db/schema";
import { addPantryItemsSchema, pantryItemIdSchema, setPantryStapleSchema } from "@/server/features/kitchen/schema";
import { addToPantry } from "@/server/features/kitchen/write";

import { userAction } from "./_clients";

/** The kitchen page, Cook and the onboarding all read the pantry. */
function refreshKitchen() {
  revalidatePath("/[locale]", "layout");
}

/** Adds items to My kitchen; a full kitchen says `conflict` (the page explains the cap). */
export const addPantryItems = userAction
  .metadata({ actionName: "addPantryItems" })
  .inputSchema(addPantryItemsSchema)
  .action(async ({ parsedInput: { names, staple }, ctx }) => {
    if ((await addToPantry(ctx.user.id, names, staple)) === "full") returnServerError<ActionErrorCode>("conflict");
    refreshKitchen();
    return { added: names.length };
  });

/** Removes one item at once; the page offers Undo (it adds the item back). */
export const removePantryItem = userAction
  .metadata({ actionName: "removePantryItem" })
  .inputSchema(pantryItemIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const [removed] = await getDb()
      .delete(pantryItems)
      .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, ctx.user.id)))
      .returning({ name: pantryItems.name, isStaple: pantryItems.isStaple });
    if (!removed) returnServerError<ActionErrorCode>("not_found");
    refreshKitchen();
    return removed;
  });

/** "Always have": a staple is never counted as missing (and later, never added to shopping). */
export const setPantryStaple = userAction
  .metadata({ actionName: "setPantryStaple" })
  .inputSchema(setPantryStapleSchema)
  .action(async ({ parsedInput: { id, staple }, ctx }) => {
    const [updated] = await getDb()
      .update(pantryItems)
      .set({ isStaple: staple })
      .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, ctx.user.id)))
      .returning({ id: pantryItems.id });
    if (!updated) returnServerError<ActionErrorCode>("not_found");
    refreshKitchen();
    return { staple };
  });
