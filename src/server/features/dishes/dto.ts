// What the UI may know about dishes. Types only: safe for the UI.
import type { Course, DietaryTag, Difficulty, Season, Unit } from "@/lib/dishes";
import type { CollectionAllowanceDto, CollectionDto } from "@/server/features/collections/dto";
import type { PhotoDto } from "@/server/features/photos/dto";
import type { DishSharingDto, PersonDto } from "@/server/features/social/dto";

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
  /** Signed link to the small photo, when there is one. */
  photoUrl: string | null;
};

export type DishListDto = {
  dishes: DishCardDto[];
  /** All dishes in the box, regardless of filters (to tell "empty box" from "no match"). */
  total: number;
  allowance: DishAllowanceDto;
  collections: CollectionDto[];
  collectionAllowance: CollectionAllowanceDto;
  /** The collection being shown, when ?collection= is one of the person's. */
  activeCollection: CollectionDto | null;
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
  /** Where an imported dish came from. */
  source: { url: string; siteName: string } | null;
  photo: PhotoDto | null;
  cooking: DishCookingDto;
  /** Whether photo uploads are set up at all (R2), so the owner sees "Add a photo" or nothing. */
  photosEnabled: boolean;
  /** The collections this dish is in. */
  collectionIds: string[];
  /** All the person's collections, for "Add to collection". */
  collections: CollectionDto[];
  collectionAllowance: CollectionAllowanceDto;
  /** Who can see it, and the owner's groups to choose from. */
  sharing: DishSharingDto;
  /** What friends who cooked it said. */
  reviews: ReviewsDto;
};

export type ReviewDto = {
  id: string;
  person: Pick<PersonDto, "id" | "displayName" | "initials" | "avatarUrl">;
  stars: number;
  review: string | null;
  /** ISO time of the rating. */
  at: string;
};

/** Ratings by people other than the owner (the owner's own is in `cooking`). */
export type ReviewsDto = { average: number | null; count: number; items: ReviewDto[] };

/** A friend's dish, read-only for the viewer. */
export type FriendDishDto = Pick<
  DishDto,
  | "id"
  | "name"
  | "difficulty"
  | "course"
  | "seasons"
  | "dietaryTags"
  | "servings"
  | "shownServings"
  | "ingredients"
  | "steps"
  | "nutrition"
  | "photo"
  | "reviews"
> & {
  owner: PersonDto;
  /** The viewer's copy of it, if they already copied it. */
  myCopyId: string | null;
};

/** The person's history with a dish: how often, how recently, and their rating. */
export type DishCookingDto = {
  timesCooked: number;
  /** "YYYY-MM-DD" of the last cook, if any. */
  lastCooked: string | null;
  rating: { stars: number; review: string | null } | null;
  /** Rating is possible once it has been cooked (PRD §3.2). */
  canRate: boolean;
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

/** A dish the form starts from that isn't saved yet: an import to review. */
export type DishDraftDto = Omit<DishFormDto, "id"> & {
  /** The page it came from, credited once saved; its photo is copied into storage on save. */
  source: { url: string; siteName: string; imageUrl: string | null } | null;
};
