"use server";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import { routing } from "@/i18n/routing";
import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { ingredients, shoppingItems } from "@/server/db/schema";
import type { Aisle } from "@/lib/dishes";
import { resolveIngredientIds } from "@/server/features/ingredients/dictionary";
import { normalize } from "@/server/features/ingredients/service";
import { addToPantry } from "@/server/features/kitchen/write";
import type { AddToShoppingResult } from "@/server/features/shopping/dto";
import { bumpVersion, dishesToShopFor, lockActiveList, shoppingLinesFor } from "@/server/features/shopping/queries";
import {
  addToShoppingSchema,
  clearShoppingSchema,
  doneShoppingSchema,
  manualItemSchema,
  restoreShoppingItemSchema,
  shoppingItemIdSchema,
  toggleShoppingItemSchema,
} from "@/server/features/shopping/schema";
import { familyOf, mergeIntoList, type IncomingLine, type ListItem } from "@/server/features/shopping/service";
import { loadProfile } from "@/server/features/profile/queries";

import { userAction } from "./_clients";

function refreshShopping() {
  revalidatePath("/[locale]/shopping", "page");
}

/** Merges lines into the person's list (one transaction, the list row locked). */
async function mergeLines(userId: string, lines: IncomingLine[], manual = false): Promise<number> {
  if (lines.length === 0) return 0;
  return getDb().transaction(async (tx) => {
    const list = await lockActiveList(tx, userId);
    const existing = await tx.select().from(shoppingItems).where(eq(shoppingItems.listId, list.id));
    const current: ListItem[] = existing.map((row) => ({
      key: row.key,
      unitFamily: row.unitFamily as ListItem["unitFamily"],
      name: row.name,
      ingredientId: row.ingredientId,
      amount: row.amount,
      unit: row.unit,
      aisle: row.aisle,
      sourceDishIds: row.sourceDishIds,
      checked: row.checked,
    }));
    const changed = mergeIntoList(current, lines);
    for (const item of changed) {
      await tx
        .insert(shoppingItems)
        .values({ listId: list.id, ...item, manual })
        .onConflictDoUpdate({
          target: [shoppingItems.listId, shoppingItems.key, shoppingItems.unitFamily],
          set: {
            amount: item.amount,
            unit: item.unit,
            checked: item.checked,
            checkedAt: new Date(),
            sourceDishIds: item.sourceDishIds,
          },
        });
    }
    await bumpVersion(tx, list.id);
    return changed.length;
  });
}

/** "Shop for this": a dish (scaled), an event's menu (scaled to the guests), or a planner week. Staples are skipped. */
export const addToShopping = userAction
  .metadata({ actionName: "addToShopping" })
  .inputSchema(addToShoppingSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<AddToShoppingResult> => {
    const locale = (await loadProfile(ctx.user.id))?.locale ?? routing.defaultLocale;
    const wanted = await dishesToShopFor(ctx.user.id, input);
    const { lines, skippedStaples } = await shoppingLinesFor(ctx.user.id, wanted, locale);
    if (wanted.length === 0 || (lines.length === 0 && skippedStaples === 0))
      returnServerError<ActionErrorCode>("not_found");
    const added = await mergeLines(ctx.user.id, lines);
    refreshShopping();
    return { added, skippedStaples };
  });

/** A typed name's dictionary entry and aisle ("bread" → bakery), or none. */
async function dictionaryFacts(name: string): Promise<{ ingredientId: string | null; aisle: Aisle }> {
  const [ingredientId = null] = await resolveIngredientIds([name]);
  if (!ingredientId) return { ingredientId, aisle: "other" };
  const [row] = await getDb()
    .select({ aisle: ingredients.aisle })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId));
  return { ingredientId, aisle: row?.aisle ?? "other" };
}

/** A hand-typed item ("paper towels"). Typing an ingredient the list already has adds to it. */
export const addShoppingItem = userAction
  .metadata({ actionName: "addShoppingItem" })
  .inputSchema(manualItemSchema)
  .action(async ({ parsedInput: { name }, ctx }) => {
    const { ingredientId, aisle } = await dictionaryFacts(name);
    await mergeLines(
      ctx.user.id,
      [
        {
          key: ingredientId ? `i:${ingredientId}` : `n:${normalize(name)}`,
          name,
          ingredientId,
          amount: null,
          unit: null,
          aisle,
          dishId: null,
        },
      ],
      true,
    );
    refreshShopping();
    return { name };
  });

/**
 * Ticks or unticks an item. Idempotent and last-write-wins by `at`, so a
 * check-off replayed from an offline phone never undoes a newer change.
 */
export const toggleShoppingItem = userAction
  .metadata({ actionName: "toggleShoppingItem" })
  .inputSchema(toggleShoppingItemSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const at = new Date(input.at);
    const applied = await getDb().transaction(async (tx) => {
      const list = await lockActiveList(tx, ctx.user.id);
      const [row] = await tx
        .update(shoppingItems)
        .set({ checked: input.checked, checkedAt: at })
        .where(
          and(
            eq(shoppingItems.id, input.id),
            eq(shoppingItems.listId, list.id),
            or(isNull(shoppingItems.checkedAt), lt(shoppingItems.checkedAt, at)),
          ),
        )
        .returning({ id: shoppingItems.id });
      if (row) await bumpVersion(tx, list.id);
      else {
        const [exists] = await tx
          .select({ id: shoppingItems.id })
          .from(shoppingItems)
          .where(and(eq(shoppingItems.id, input.id), eq(shoppingItems.listId, list.id)));
        if (!exists) returnServerError<ActionErrorCode>("not_found");
      }
      return Boolean(row);
    });
    refreshShopping();
    return { applied };
  });

/** Removes one item at once; Undo puts it back as it was. */
export const removeShoppingItem = userAction
  .metadata({ actionName: "removeShoppingItem" })
  .inputSchema(shoppingItemIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const removed = await getDb().transaction(async (tx) => {
      const list = await lockActiveList(tx, ctx.user.id);
      const [row] = await tx
        .delete(shoppingItems)
        .where(and(eq(shoppingItems.id, id), eq(shoppingItems.listId, list.id)))
        .returning({
          name: shoppingItems.name,
          amount: shoppingItems.amount,
          unit: shoppingItems.unit,
          manual: shoppingItems.manual,
          checked: shoppingItems.checked,
        });
      if (!row) returnServerError<ActionErrorCode>("not_found");
      await bumpVersion(tx, list.id);
      return row;
    });
    refreshShopping();
    return removed;
  });

export const restoreShoppingItem = userAction
  .metadata({ actionName: "restoreShoppingItem" })
  .inputSchema(restoreShoppingItemSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const { ingredientId, aisle } = await dictionaryFacts(input.name);
    await mergeLines(
      ctx.user.id,
      [
        {
          key: ingredientId ? `i:${ingredientId}` : `n:${normalize(input.name)}`,
          name: input.name,
          ingredientId,
          amount: input.amount,
          unit: input.unit,
          aisle,
          dishId: null,
        },
      ],
      input.manual,
    );
    refreshShopping();
    return { name: input.name, family: familyOf(input.unit) };
  });

/** Clear the ticked items, or the whole list (the page asks first for "all"). */
export const clearShoppingList = userAction
  .metadata({ actionName: "clearShoppingList" })
  .inputSchema(clearShoppingSchema)
  .action(async ({ parsedInput: { scope }, ctx }) => {
    const removed = await getDb().transaction(async (tx) => {
      const list = await lockActiveList(tx, ctx.user.id);
      const rows = await tx
        .delete(shoppingItems)
        .where(
          and(eq(shoppingItems.listId, list.id), scope === "checked" ? eq(shoppingItems.checked, true) : undefined),
        )
        .returning({ id: shoppingItems.id });
      await bumpVersion(tx, list.id);
      return rows.length;
    });
    refreshShopping();
    return { removed };
  });

/**
 * "Done shopping" (PRD §3.4/3.5): the ticked items leave the list and, if the
 * person agrees, recipe ingredients among them go into My kitchen.
 */
export const doneShopping = userAction
  .metadata({ actionName: "doneShopping" })
  .inputSchema(doneShoppingSchema)
  .action(async ({ parsedInput: { addToKitchen }, ctx }) => {
    const bought = await getDb().transaction(async (tx) => {
      const list = await lockActiveList(tx, ctx.user.id);
      const rows = await tx
        .delete(shoppingItems)
        .where(and(eq(shoppingItems.listId, list.id), eq(shoppingItems.checked, true)))
        .returning({ name: shoppingItems.name, manual: shoppingItems.manual });
      await bumpVersion(tx, list.id);
      return rows;
    });
    const food = bought.filter((b) => !b.manual).map((b) => b.name);
    let addedToKitchen = 0;
    if (addToKitchen && food.length > 0) {
      for (let i = 0; i < food.length; i += 40) {
        if ((await addToPantry(ctx.user.id, food.slice(i, i + 40), false)) === "added")
          addedToKitchen += food.slice(i, i + 40).length;
      }
    }
    refreshShopping();
    revalidatePath("/[locale]/kitchen", "page");
    return { bought: bought.length, addedToKitchen };
  });
