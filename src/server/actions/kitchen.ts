"use server";

import { and, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { pantryItems } from "@/server/db/schema";
import { loadReadyToCook } from "@/server/features/cook/queries";
import { loadPantry } from "@/server/features/kitchen/queries";
import {
  addPantryItemsSchema,
  pantryItemIdSchema,
  kitchenReadSchema,
  setPantryStapleSchema,
} from "@/server/features/kitchen/schema";
import { addToPantry } from "@/server/features/kitchen/write";

import { userAction, userReadAction } from "./_clients";

// Every write returns the updated kitchen, and the page puts it straight into
// its cache. The browser also remembers pages it has shown (lib/page-cache.ts):
// Cook, Spin, the Assistant and the onboarding read the kitchen, so each write
// drops those copies too.
function refreshKitchen() {
  revalidatePath("/[locale]", "layout");
}

/** Adds items to My kitchen; a full kitchen says `conflict` (the page explains the cap). */
export const addPantryItems = userAction
  .metadata({ actionName: "addPantryItems" })
  .inputSchema(addPantryItemsSchema)
  .action(async ({ parsedInput: { names, staple, locale }, ctx }) => {
    if ((await addToPantry(ctx.user.id, names, staple)) === "full") returnServerError<ActionErrorCode>("conflict");
    refreshKitchen();
    return loadPantry(ctx.user.id, locale);
  });

/** Removes one item at once; the page offers Undo (it adds the item back). */
export const removePantryItem = userAction
  .metadata({ actionName: "removePantryItem" })
  .inputSchema(pantryItemIdSchema)
  .action(async ({ parsedInput: { id, locale }, ctx }) => {
    const [removed] = await getDb()
      .delete(pantryItems)
      .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, ctx.user.id)))
      .returning({ id: pantryItems.id });
    if (!removed) returnServerError<ActionErrorCode>("not_found");
    refreshKitchen();
    return loadPantry(ctx.user.id, locale);
  });

/** "Always have": a staple is never counted as missing (and later, never added to shopping). */
export const setPantryStaple = userAction
  .metadata({ actionName: "setPantryStaple" })
  .inputSchema(setPantryStapleSchema)
  .action(async ({ parsedInput: { id, staple, locale }, ctx }) => {
    const [updated] = await getDb()
      .update(pantryItems)
      .set({ isStaple: staple })
      .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, ctx.user.id)))
      .returning({ id: pantryItems.id });
    if (!updated) returnServerError<ActionErrorCode>("not_found");
    refreshKitchen();
    return loadPantry(ctx.user.id, locale);
  });

/** My kitchen's "Ready to cook" panel, asked again after the kitchen changes. Read-only. */
export const getReadyToCook = userReadAction
  .metadata({ actionName: "getReadyToCook" })
  .inputSchema(kitchenReadSchema)
  .action(async ({ parsedInput: { locale }, ctx }) => loadReadyToCook(ctx.user.id, locale));

/** My kitchen again, when the page comes back into view (another tab or device may have changed it). Read-only. */
export const getKitchen = userReadAction
  .metadata({ actionName: "getKitchen" })
  .inputSchema(kitchenReadSchema)
  .action(async ({ parsedInput: { locale }, ctx }) => loadPantry(ctx.user.id, locale));
