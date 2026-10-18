// What the UI may know about dishes. Types only: safe for the UI.
import type { Course, DietaryTag, Difficulty, Season, Unit } from "@/lib/dishes";

/** How many dishes the plan holds, and what that allows right now. */
export type DishAllowanceDto = {
  count: number;
  /** null = unlimited. */
  limit: number | null;
  canAdd: boolean;
  /** Over the limit after a downgrade: view and cook, but no adding or editing. */
  readOnly: boolean;
};

export type DishCardDto = {
  id: string;
  name: string;
  course: Course;
  difficulty: Difficulty;
  servings: number;
  ingredientCount: number;
  stepCount: number;
  /** Sum of the step timers, when there are any. */
  timerMinutes: number | null;
  dietaryTags: DietaryTag[];
  favorite: boolean;
};

export type DishListDto = {
  dishes: DishCardDto[];
  /** All dishes in the box, regardless of filters (to tell "empty box" from "no match"). */
  total: number;
  allowance: DishAllowanceDto;
};

export type IngredientDto = { name: string; amount: number | null; unit: Unit | null; note: string | null };

export type StepDto = { text: string; timerMinutes: number | null; prepDayBefore: boolean };

export type NutritionDto = {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type DishDto = {
  id: string;
  name: string;
  difficulty: Difficulty;
  course: Course;
  seasons: Season[];
  dietaryTags: DietaryTag[];
  /** What the recipe is written for. */
  servings: number;
  /** What the ingredients below are scaled to. */
  shownServings: number;
  ingredients: IngredientDto[];
  steps: StepDto[];
  /** null when no value was entered. */
  nutrition: NutritionDto | null;
  favorite: boolean;
  note: string | null;
  /** Editing is paused while the box is over the plan's limit. */
  readOnly: boolean;
};

/** The dish as the edit form needs it (unscaled). */
export type DishFormDto = {
  id: string;
  name: string;
  difficulty: Difficulty;
  course: Course;
  servings: number;
  seasons: Season[];
  dietaryTags: DietaryTag[];
  ingredients: IngredientDto[];
  steps: StepDto[];
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};
