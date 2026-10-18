import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import { dishes, dishIngredients, dishNotes, dishSteps, favorites } from "@/server/db/schema";
import { getEntitlement, limitFor } from "@/server/quota/entitlement";
import { matches } from "@/server/features/ingredients/service";

import type { DishAllowanceDto, DishDto, DishFormDto, DishListDto, StepDto } from "./dto";
import type { dishListFiltersSchema } from "./schema";
import { findOwnDish } from "./policy";
import { dishAllowance, scaleAmount } from "./service";

type DishListFilters = ReturnType<(typeof dishListFiltersSchema)["parse"]>;

/** How many dishes the person has against their plan's cap (`plan_limits`, never a constant). */
export async function loadDishAllowance(userId: string, executor: Executor = getDb()): Promise<DishAllowanceDto> {
  const [[row], { plan }] = await Promise.all([
    executor
      .select({ n: count() })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt))),
    getEntitlement(userId),
  ]);
  const { limit } = await limitFor(plan, "dishes", executor);
  return dishAllowance(row?.n ?? 0, limit);
}

/**
 * Ids of the caller's dishes whose name or an ingredient matches `wanted`,
 * by the one matching service: "oil" finds "Olive oil", never "Boiled".
 */
async function dishesMatching(userId: string, wanted: string): Promise<string[]> {
  const own = and(eq(dishes.userId, userId), isNull(dishes.deletedAt));
  const db = getDb();
  const [named, lines] = await Promise.all([
    db.select({ dishId: dishes.id, name: dishes.name }).from(dishes).where(own),
    db
      .select({ dishId: dishIngredients.dishId, name: dishIngredients.name })
      .from(dishIngredients)
      .innerJoin(dishes, eq(dishes.id, dishIngredients.dishId))
      .where(own),
  ]);
  return [...new Set([...named, ...lines].filter((row) => matches(row.name, wanted)).map((row) => row.dishId))];
}

/** My Dishes: the caller's box, filtered, most recently changed first. */
export const listMyDishes = cache(async (filters: DishListFilters): Promise<DishListDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const db = getDb();

  const own = and(eq(dishes.userId, userId), isNull(dishes.deletedAt));
  const matching = filters.q ? await dishesMatching(userId, filters.q) : [];
  const search = filters.q
    ? or(
        // The name or an ingredient matches ("lentils" finds the soup)…
        matching.length > 0 ? inArray(dishes.id, matching) : undefined,
        // …or the name is a close spelling ("taijne" → "Tajine").
        sql`word_similarity(${filters.q}, ${dishes.name}) > 0.4`,
      )
    : undefined;

  const rows = await db
    .select({
      id: dishes.id,
      name: dishes.name,
      course: dishes.course,
      difficulty: dishes.difficulty,
      servings: dishes.servings,
      dietaryTags: dishes.dietaryTags,
      favorite: sql<boolean>`${favorites.dishId} is not null`,
      ingredientCount: sql<number>`(select count(*)::int from ${dishIngredients} where ${dishIngredients.dishId} = ${dishes.id})`,
      stepCount: sql<number>`(select count(*)::int from ${dishSteps} where ${dishSteps.dishId} = ${dishes.id})`,
      timerSeconds: sql<
        number | null
      >`(select sum(${dishSteps.timerSeconds})::int from ${dishSteps} where ${dishSteps.dishId} = ${dishes.id})`,
    })
    .from(dishes)
    .leftJoin(favorites, and(eq(favorites.dishId, dishes.id), eq(favorites.userId, userId)))
    .where(
      and(
        own,
        filters.course ? eq(dishes.course, filters.course) : undefined,
        filters.favorites ? sql`${favorites.dishId} is not null` : undefined,
        search,
      ),
    )
    .orderBy(desc(dishes.updatedAt));

  const allowance = await loadDishAllowance(userId);
  return {
    dishes: rows.map(({ timerSeconds, ...row }) => ({
      ...row,
      timerMinutes: timerSeconds ? Math.round(timerSeconds / 60) : null,
    })),
    total: allowance.count,
    allowance,
  };
});

/** A dish the caller just deleted (still restorable), for the Undo toast. */
export const getDeletedDish = cache(async (dishId: string): Promise<{ id: string; name: string } | null> => {
  const session = await getSession();
  if (!session) return null;
  const [dish] = await getDb()
    .select({ id: dishes.id, name: dishes.name })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.userId, session.user.id), isNotNull(dishes.deletedAt)))
    .limit(1);
  return dish ?? null;
});

/** For "New dish": may the caller add one? */
export const getMyDishAllowance = cache(async (): Promise<DishAllowanceDto | null> => {
  const session = await getSession();
  return session ? loadDishAllowance(session.user.id) : null;
});

async function loadContents(dishId: string) {
  const db = getDb();
  const [ingredients, steps] = await Promise.all([
    db
      .select({
        name: dishIngredients.name,
        amount: dishIngredients.amount,
        unit: dishIngredients.unit,
        note: dishIngredients.note,
      })
      .from(dishIngredients)
      .where(eq(dishIngredients.dishId, dishId))
      .orderBy(asc(dishIngredients.position)),
    db
      .select({ text: dishSteps.text, timerSeconds: dishSteps.timerSeconds, prepDayBefore: dishSteps.prepDayBefore })
      .from(dishSteps)
      .where(eq(dishSteps.dishId, dishId))
      .orderBy(asc(dishSteps.position)),
  ]);
  const toStep = (s: (typeof steps)[number]): StepDto => ({
    text: s.text,
    timerMinutes: s.timerSeconds === null ? null : Math.round(s.timerSeconds / 60),
    prepDayBefore: s.prepDayBefore,
  });
  return { ingredients, steps: steps.map(toStep) };
}

/** The dish page, with ingredients scaled to `servings` on the server. */
export const getDish = cache(async (dishId: string, servings?: number): Promise<DishDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const dish = await findOwnDish(userId, dishId);
  if (!dish) return null;

  const db = getDb();
  const [contents, [note], [favorite], allowance] = await Promise.all([
    loadContents(dish.id),
    db
      .select({ text: dishNotes.text })
      .from(dishNotes)
      .where(and(eq(dishNotes.dishId, dish.id), eq(dishNotes.userId, userId)))
      .limit(1),
    db
      .select({ dishId: favorites.dishId })
      .from(favorites)
      .where(and(eq(favorites.dishId, dish.id), eq(favorites.userId, userId)))
      .limit(1),
    loadDishAllowance(userId),
  ]);

  const shownServings = servings ?? dish.servings;
  const nutrition = { caloriesKcal: dish.caloriesKcal, proteinG: dish.proteinG, carbsG: dish.carbsG, fatG: dish.fatG };
  return {
    id: dish.id,
    name: dish.name,
    difficulty: dish.difficulty,
    course: dish.course,
    seasons: dish.seasons,
    dietaryTags: dish.dietaryTags,
    servings: dish.servings,
    shownServings,
    ingredients: contents.ingredients.map((i) => ({
      ...i,
      amount: scaleAmount(i.amount, dish.servings, shownServings),
    })),
    steps: contents.steps,
    nutrition: Object.values(nutrition).some((v) => v !== null) ? nutrition : null,
    favorite: Boolean(favorite),
    note: note?.text ?? null,
    readOnly: allowance.readOnly,
  };
});

/** The edit form's starting values (only for the owner). */
export const getDishForEdit = cache(async (dishId: string): Promise<DishFormDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const dish = await findOwnDish(session.user.id, dishId);
  if (!dish) return null;
  const contents = await loadContents(dish.id);
  return {
    id: dish.id,
    name: dish.name,
    difficulty: dish.difficulty,
    course: dish.course,
    servings: dish.servings,
    seasons: dish.seasons,
    dietaryTags: dish.dietaryTags,
    ...contents,
    caloriesKcal: dish.caloriesKcal,
    proteinG: dish.proteinG,
    carbsG: dish.carbsG,
    fatG: dish.fatG,
  };
});
