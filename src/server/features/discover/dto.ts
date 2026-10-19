// What the UI may know about the Discover catalog. Types only: safe for the UI.
import type { CatalogCollection, Course, DietaryTag, Difficulty, Season } from "@/lib/dishes";
import type { IngredientDto, StepDto } from "@/server/features/dishes/dto";

export type CatalogCardDto = {
  slug: string;
  name: string;
  description: string;
  /** ISO 3166-1 alpha-2; the UI names it with Intl.DisplayNames. */
  country: string;
  course: Course;
  difficulty: Difficulty;
  servings: number;
  dietaryTags: DietaryTag[];
  collections: CatalogCollection[];
  timerMinutes: number | null;
  /** The viewer already has a copy in their box. */
  saved: boolean;
};

export type DiscoverDto = {
  featured: CatalogCardDto[];
  dishes: CatalogCardDto[];
  /** Countries that have dishes, for the filter. */
  countries: string[];
  /** With "ingredients you have": did dishes use all of them, only some, or none? */
  matchMode: "all" | "any" | "none" | null;
  signedIn: boolean;
};

export type CatalogDishDto = CatalogCardDto & {
  seasons: Season[];
  /** What the ingredients below are scaled to. */
  shownServings: number;
  ingredients: IngredientDto[];
  steps: StepDto[];
  /** The viewer's copy, when they saved it. */
  savedDishId: string | null;
  signedIn: boolean;
};

export type SaveCatalogDishResult = { dishId: string; alreadySaved: boolean };
