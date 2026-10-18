import "server-only";

import { eq, sql } from "drizzle-orm";

import type { Executor } from "@/server/db/client";
import { dishIngredients, dishSteps } from "@/server/db/schema";
import { resolveIngredientIds } from "@/server/features/ingredients/dictionary";

import type { DishInput } from "./schema";

// Shared by the dish actions and the backup import, so a dish is written the
// same way however it arrives.

/**
 * Serialises dish-count changes per person, so two tabs adding the 50th dish
 * at once can't both succeed (AGENT_RULES §3.6).
 */
export async function lockDishCount(tx: Executor, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`dishes:${userId}`}, 0))`);
}

type DishFields = Pick<
  DishInput,
  | "name"
  | "difficulty"
  | "course"
  | "servings"
  | "seasons"
  | "dietaryTags"
  | "caloriesKcal"
  | "proteinG"
  | "carbsG"
  | "fatG"
>;

/** The dish row's own columns (ingredients and steps are written by writeContents). */
export function dishValues(input: DishFields) {
  return {
    name: input.name,
    difficulty: input.difficulty,
    course: input.course,
    servings: input.servings,
    seasons: input.seasons,
    dietaryTags: input.dietaryTags,
    caloriesKcal: input.caloriesKcal,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  };
}

/**
 * Ingredients and steps are written as a whole, in the order the form sent
 * them. Lines whose name is a dictionary entry are linked to it, so matching,
 * aisles and the shopping merge know what they are.
 */
export async function writeContents(tx: Executor, dishId: string, input: DishInput) {
  const ingredientIds = await resolveIngredientIds(input.ingredients.map((i) => i.name));
  await tx.delete(dishIngredients).where(eq(dishIngredients.dishId, dishId));
  await tx.delete(dishSteps).where(eq(dishSteps.dishId, dishId));
  await tx
    .insert(dishIngredients)
    .values(
      input.ingredients.map((i, position) => ({ dishId, position, ...i, ingredientId: ingredientIds[position] })),
    );
  if (input.steps.length > 0) {
    await tx.insert(dishSteps).values(
      input.steps.map((s, position) => ({
        dishId,
        position,
        text: s.text,
        timerSeconds: s.timerMinutes === null ? null : s.timerMinutes * 60,
        prepDayBefore: s.prepDayBefore,
      })),
    );
  }
}
