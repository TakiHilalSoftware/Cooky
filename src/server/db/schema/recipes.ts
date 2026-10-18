import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { AISLES, COURSES, DIETARY_TAGS, DIFFICULTIES, SEASONS, UNITS } from "@/lib/dishes";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const difficultyEnum = pgEnum("difficulty", DIFFICULTIES);
export const courseEnum = pgEnum("course", COURSES);
export const seasonEnum = pgEnum("season", SEASONS);
export const dietaryTagEnum = pgEnum("dietary_tag", DIETARY_TAGS);
export const unitEnum = pgEnum("unit", UNITS);
export const aisleEnum = pgEnum("aisle", AISLES);

/**
 * The ingredient dictionary (ARCHITECTURE §4.3): everyday staples in EN/FR/AR
 * with regional variants, seeded by scripts/seed-ingredients.ts. `search` holds
 * every name and variant, normalized by the matching service, for autocomplete.
 */
export const ingredients = pgTable(
  "ingredients",
  {
    id: id(),
    /** Stable seed key, e.g. "tomato". */
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr").notNull(),
    nameAr: text("name_ar").notNull(),
    /** Other names people use: plurals, regional words (Maghreb, Mashreq), spellings. */
    variants: text("variants")
      .array()
      .notNull()
      .default(sql`'{}'`),
    aisle: aisleEnum("aisle").notNull(),
    defaultUnit: unitEnum("default_unit"),
    /** "Most kitchens have this" (salt, oil): suggested first, and skipped by the shopping list later. */
    isCommonStaple: boolean("is_common_staple").notNull().default(false),
    search: text("search").notNull(),
    ...timestamps,
  },
  (t) => [index("ingredients_search_trgm_idx").using("gin", sql`${t.search} gin_trgm_ops`)],
);

/**
 * A dish in someone's recipe box (ARCHITECTURE §4.3). Columns for photos,
 * visibility and catalog copies arrive with the slices that use them.
 */
export const dishes = pgTable(
  "dishes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    course: courseEnum("course").notNull(),
    seasons: seasonEnum("seasons")
      .array()
      .notNull()
      .default(sql`'{}'`),
    servings: integer("servings").notNull(),
    dietaryTags: dietaryTagEnum("dietary_tags")
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** Nutrition per serving, all optional. */
    caloriesKcal: integer("calories_kcal"),
    proteinG: numeric("protein_g", { precision: 6, scale: 1, mode: "number" }),
    carbsG: numeric("carbs_g", { precision: 6, scale: 1, mode: "number" }),
    fatG: numeric("fat_g", { precision: 6, scale: 1, mode: "number" }),
    /** Set on delete so Undo can bring the dish back; purged a day later by a job. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("dishes_user_id_idx").on(t.userId, t.deletedAt),
    // Typo-tolerant "search my dishes".
    index("dishes_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const dishIngredients = pgTable(
  "dish_ingredients",
  {
    id: id(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    /** null for "salt, to taste". */
    amount: numeric("amount", { precision: 10, scale: 3, mode: "number" }),
    unit: unitEnum("unit"),
    note: text("note"),
    /** The dictionary entry this line is, when the name matches one (set on save). */
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("dish_ingredients_dish_id_idx").on(t.dishId, t.position),
    index("dish_ingredients_ingredient_id_idx").on(t.ingredientId),
  ],
);

export const dishSteps = pgTable(
  "dish_steps",
  {
    id: id(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    timerSeconds: integer("timer_seconds"),
    prepDayBefore: boolean("prep_day_before").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("dish_steps_dish_id_idx").on(t.dishId, t.position)],
);

/** "Less salt next time": private to the person who wrote it. */
export const dishNotes = pgTable(
  "dish_notes",
  {
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.dishId, t.userId] }), index("dish_notes_user_id_idx").on(t.userId)],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.dishId] }), index("favorites_dish_id_idx").on(t.dishId)],
);

/** Named groups of dishes ("Quick weeknights"). The count is capped per plan (`plan_limits.collections`). */
export const collections = pgTable(
  "collections",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    /** Set on delete so Undo can restore it; purged a day later with deleted dishes. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("collections_user_id_idx").on(t.userId, t.deletedAt),
    // One live collection per name per person ("Ramadan" and "ramadan" are the same).
    uniqueIndex("collections_user_name_uniq")
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const collectionDishes = pgTable(
  "collection_dishes",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.dishId] }), index("collection_dishes_dish_id_idx").on(t.dishId)],
);

export const backupImportStatusEnum = pgEnum("backup_import_status", ["queued", "running", "done", "failed"]);

/**
 * A recipe backup being imported in the background (PRD §3.2). The file's
 * dishes are kept only until the job has run, then cleared; the summary stays.
 */
export const backupImports = pgTable(
  "backup_imports",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: backupImportStatusEnum("status").notNull().default("queued"),
    /** The dishes from the file, validated one by one when the job runs. */
    dishes: jsonb("dishes"),
    total: integer("total").notNull(),
    imported: integer("imported").notNull().default(0),
    /** Why dishes were skipped: { duplicate, full, invalid }. */
    skipped: jsonb("skipped").$type<Record<string, number>>(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("backup_imports_user_id_idx").on(t.userId, t.createdAt)],
);
