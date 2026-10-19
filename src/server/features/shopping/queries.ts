import "server-only";

import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { addDays } from "@/lib/dates";
import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import {
  dishes,
  dishIngredients,
  eventDishes,
  events,
  ingredients,
  plannedMeals,
  profiles,
  shoppingItems,
  shoppingListMembers,
  shoppingLists,
} from "@/server/db/schema";
import { hasFeature } from "@/server/quota/tries";
import { loadHave } from "@/server/features/cook/queries";
import { isHad } from "@/server/features/cook/service";
import { scaleAmount } from "@/server/features/dishes/service";
import { normalize } from "@/server/features/ingredients/service";

import type { HouseholdDto, ShoppingListDto } from "./dto";
import { toBuy, type IncomingLine } from "./service";

const localName = (locale: AppLocale) =>
  locale === "fr" ? ingredients.nameFr : locale === "ar" ? ingredients.nameAr : ingredients.nameEn;

/** The person's list, created on first use. Locked for the rest of the transaction. */
export async function lockOwnList(tx: Executor, userId: string) {
  await tx.insert(shoppingLists).values({ ownerId: userId }).onConflictDoNothing();
  const [list] = await tx.select().from(shoppingLists).where(eq(shoppingLists.ownerId, userId)).for("update");
  return list!;
}

/**
 * The household list someone has joined, when the owner still has Pro (PRD
 * §3.5); otherwise null and they use their own list.
 */
export async function sharedListFor(userId: string, executor: Executor = getDb()) {
  const [membership] = await executor
    .select({ listId: shoppingListMembers.listId, ownerId: shoppingLists.ownerId })
    .from(shoppingListMembers)
    .innerJoin(shoppingLists, eq(shoppingLists.id, shoppingListMembers.listId))
    .where(and(eq(shoppingListMembers.userId, userId), eq(shoppingListMembers.status, "active")))
    .limit(1);
  if (!membership) return null;
  return (await hasFeature(membership.ownerId, "household_list")) ? membership : null;
}

/** The list this person shops from (their household's, or their own), locked for the transaction. */
export async function lockActiveList(tx: Executor, userId: string) {
  const shared = await sharedListFor(userId, tx);
  if (!shared) return lockOwnList(tx, userId);
  const [list] = await tx.select().from(shoppingLists).where(eq(shoppingLists.id, shared.listId)).for("update");
  return list!;
}

/** Every write bumps the version, so offline copies can tell they're stale. */
export async function bumpVersion(tx: Executor, listId: string) {
  await tx
    .update(shoppingLists)
    .set({ version: sql`${shoppingLists.version} + 1` })
    .where(eq(shoppingLists.id, listId));
}

export const getShoppingList = cache(async (locale: AppLocale): Promise<ShoppingListDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const [shared, household] = await Promise.all([sharedListFor(userId), loadHousehold(userId)]);
  const [list] = await getDb()
    .select()
    .from(shoppingLists)
    .where(shared ? eq(shoppingLists.id, shared.listId) : eq(shoppingLists.ownerId, userId))
    .limit(1);
  if (!list) return { version: 0, items: [], household };
  const rows = await getDb()
    .select({
      id: shoppingItems.id,
      name: sql<string>`coalesce(${localName(locale)}, ${shoppingItems.name})`,
      amount: shoppingItems.amount,
      unit: shoppingItems.unit,
      aisle: shoppingItems.aisle,
      checked: shoppingItems.checked,
      manual: shoppingItems.manual,
      sources: shoppingItems.sourceDishIds,
    })
    .from(shoppingItems)
    .leftJoin(ingredients, eq(ingredients.id, shoppingItems.ingredientId))
    .where(eq(shoppingItems.listId, list.id))
    .orderBy(asc(shoppingItems.createdAt), asc(shoppingItems.id));
  return {
    version: list.version,
    items: rows.map(({ sources, ...item }) => ({ ...item, ...toBuy(item), dishCount: sources.length })),
    household,
  };
});

/** Which dishes to shop for, and at how many servings each. Only the caller's own, live dishes. */
export async function dishesToShopFor(
  userId: string,
  target:
    | { source: "dish"; id: string; servings?: number }
    | { source: "event"; id: string }
    | { source: "week"; weekStart: string },
): Promise<{ dishId: string; servings: number | null }[]> {
  const db = getDb();
  if (target.source === "dish") return [{ dishId: target.id, servings: target.servings ?? null }];
  if (target.source === "event") {
    const [event] = await db
      .select({ guests: events.guests })
      .from(events)
      .where(and(eq(events.id, target.id), eq(events.userId, userId)))
      .limit(1);
    if (!event) return [];
    const menu = await db
      .select({ dishId: eventDishes.dishId })
      .from(eventDishes)
      .where(eq(eventDishes.eventId, target.id));
    return menu.map((m) => ({ dishId: m.dishId, servings: event.guests }));
  }
  const meals = await db
    .select({ dishId: plannedMeals.dishId })
    .from(plannedMeals)
    .where(
      and(
        eq(plannedMeals.userId, userId),
        gte(plannedMeals.date, target.weekStart),
        lte(plannedMeals.date, addDays(target.weekStart, 6)),
      ),
    );
  return meals.map((m) => ({ dishId: m.dishId, servings: null }));
}

/**
 * The recipe lines for those dishes, scaled, keyed for merging, in the
 * viewer's language, minus the person's staples (PRD §3.5: staples are skipped).
 */
export async function shoppingLinesFor(
  userId: string,
  wanted: { dishId: string; servings: number | null }[],
  locale: AppLocale,
): Promise<{ lines: IncomingLine[]; skippedStaples: number }> {
  if (wanted.length === 0) return { lines: [], skippedStaples: 0 };
  const ids = [...new Set(wanted.map((w) => w.dishId))];
  const [owned, rows, have] = await Promise.all([
    getDb()
      .select({ id: dishes.id, servings: dishes.servings })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt), inArray(dishes.id, ids))),
    getDb()
      .select({
        dishId: dishIngredients.dishId,
        name: dishIngredients.name,
        amount: dishIngredients.amount,
        unit: dishIngredients.unit,
        ingredientId: dishIngredients.ingredientId,
        localName: localName(locale),
        aisle: ingredients.aisle,
      })
      .from(dishIngredients)
      .leftJoin(ingredients, eq(ingredients.id, dishIngredients.ingredientId))
      .where(inArray(dishIngredients.dishId, ids))
      .orderBy(dishIngredients.dishId, dishIngredients.position),
    loadHave(userId, locale),
  ]);
  const servingsOf = new Map(owned.map((d) => [d.id, d.servings]));
  const staples = have.filter((h) => h.isStaple).map((h) => h.item);
  const lines: IncomingLine[] = [];
  let skippedStaples = 0;
  for (const { dishId, servings } of wanted) {
    const base = servingsOf.get(dishId);
    if (!base) continue;
    for (const row of rows.filter((r) => r.dishId === dishId)) {
      if (isHad({ name: row.name, displayName: row.name, ingredientId: row.ingredientId }, staples)) {
        skippedStaples++;
        continue;
      }
      lines.push({
        key: row.ingredientId ? `i:${row.ingredientId}` : `n:${normalize(row.name)}`,
        name: row.localName ?? row.name,
        ingredientId: row.ingredientId,
        amount: scaleAmount(row.amount, base, servings ?? base),
        unit: row.unit,
        aisle: row.aisle ?? "other",
        dishId,
      });
    }
  }
  return { lines, skippedStaples };
}

/**
 * What the shopping page shows about the household: as owner, who's in and
 * whether sharing is on the plan; as member, whose list it is; and invites
 * waiting for an answer. Display names only, never emails.
 */
export async function loadHousehold(userId: string): Promise<HouseholdDto> {
  const db = getDb();
  const [canShare, [ownList], invites, shared] = await Promise.all([
    hasFeature(userId, "household_list"),
    db.select({ id: shoppingLists.id }).from(shoppingLists).where(eq(shoppingLists.ownerId, userId)).limit(1),
    db
      .select({ listId: shoppingListMembers.listId, fromName: profiles.displayName })
      .from(shoppingListMembers)
      .innerJoin(shoppingLists, eq(shoppingLists.id, shoppingListMembers.listId))
      .innerJoin(profiles, eq(profiles.userId, shoppingLists.ownerId))
      .where(and(eq(shoppingListMembers.userId, userId), eq(shoppingListMembers.status, "pending"))),
    sharedListFor(userId),
  ]);
  const members = ownList
    ? await db
        .select({ userId: shoppingListMembers.userId, name: profiles.displayName, status: shoppingListMembers.status })
        .from(shoppingListMembers)
        .innerJoin(profiles, eq(profiles.userId, shoppingListMembers.userId))
        .where(eq(shoppingListMembers.listId, ownList.id))
    : [];
  let sharedBy: string | null = null;
  if (shared) {
    const [owner] = await db
      .select({ name: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, shared.ownerId));
    sharedBy = owner?.name ?? null;
  }
  return { canShare, members, invites, sharedBy };
}
