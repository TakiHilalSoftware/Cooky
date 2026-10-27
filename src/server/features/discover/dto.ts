// What the UI may know about the Discover catalog. Types only: safe for the UI.
import type { CatalogCollection, Course, DietaryTag, Difficulty, DiscoverSort, Season } from "@/lib/dishes";
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
  /** A real photo (catalog or curated); null draws the illustrated cover. */
  photoUrl: string | null;
};

/** What sets a suggested dish apart for this person, shown on its card. */
export type SuggestionReason =
  /** Key ingredients from their kitchen the dish uses (staples like salt are never named). */
  | { kind: "have"; names: string[] }
  /** From a country whose dishes they saved (the card already names it). */
  | { kind: "country" };

export type CatalogPickDto = CatalogCardDto & { reason: SuggestionReason | null };

/** One slice of Discover's list, for scrolling further. */
export type DiscoverPageDto = {
  /** With a reason each when the order is "for you". */
  dishes: CatalogPickDto[];
  /** The next page to ask for, or null at the end. */
  nextPage: number | null;
};

export type DiscoverDto = DiscoverPageDto & {
  /** Unfiltered first screen only; empty otherwise. */
  featured: CatalogCardDto[];
  /** Every dish matching the filters; `dishes` holds the pages shown so far. */
  total: number;
  /** The order in effect (the viewer's default when the URL has none). */
  sort: DiscoverSort;
  /** Countries that have dishes, for the filter. */
  countries: string[];
  /** With "ingredients you have": did dishes use all of them, only some, or none? */
  matchMode: "all" | "any" | "none" | null;
  signedIn: boolean;
};

/** The landing page's dishes: picks for a signed-in person, featured ones for visitors. */
export type HomeDishesDto = {
  dishes: CatalogPickDto[];
  personalized: boolean;
  countryCount: number;
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
