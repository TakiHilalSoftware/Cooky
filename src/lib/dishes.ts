/**
 * The vocabulary of a dish (PRD §3.2), shared by the schema, the forms and
 * the UI. Values only; labels live in messages/*.json under `dishes.*`.
 */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const COURSES = ["appetizer", "main", "side", "dessert", "drinks"] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "halal",
  "gluten_free",
  "dairy_free",
  "nut_free",
  "egg_free",
] as const;
/** Structured units scale and convert; anything else goes in the ingredient's note. */
export const UNITS = [
  "g",
  "kg",
  "ml",
  "cl",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "piece",
  "clove",
  "pinch",
  "bunch",
  "slice",
  "can",
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type Course = (typeof COURSES)[number];
export type Season = (typeof SEASONS)[number];
export type DietaryTag = (typeof DIETARY_TAGS)[number];
export type Unit = (typeof UNITS)[number];

/** Form and schema bounds (shared so the form can hint before the server decides). */
export const DISH_BOUNDS = {
  nameMax: 120,
  servingsMin: 1,
  servingsMax: 100,
  ingredientsMax: 100,
  ingredientNameMax: 120,
  ingredientNoteMax: 120,
  amountMax: 100_000,
  stepsMax: 60,
  stepTextMax: 2000,
  timerMinutesMax: 24 * 60,
  noteMax: 2000,
  caloriesMax: 10_000,
  macroMax: 1000,
} as const;

/** Supermarket aisles: the shopping list groups by these (Phase 5). */
export const AISLES = [
  "produce",
  "meat_fish",
  "dairy_eggs",
  "bakery",
  "grains_pasta",
  "canned_jars",
  "spices",
  "oils_condiments",
  "baking",
  "frozen",
  "drinks",
  "other",
] as const;
export type Aisle = (typeof AISLES)[number];
