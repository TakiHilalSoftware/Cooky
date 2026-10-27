import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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

import { AISLES, CATALOG_COLLECTIONS, COURSES, DIETARY_TAGS, DIFFICULTIES, SEASONS, UNITS } from "@/lib/dishes";

import { DISH_VISIBILITIES } from "@/lib/social";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const difficultyEnum = pgEnum("difficulty", DIFFICULTIES);
export const courseEnum = pgEnum("course", COURSES);
export const seasonEnum = pgEnum("season", SEASONS);
export const dietaryTagEnum = pgEnum("dietary_tag", DIETARY_TAGS);
export const unitEnum = pgEnum("unit", UNITS);
export const aisleEnum = pgEnum("aisle", AISLES);
export const dishVisibilityEnum = pgEnum("dish_visibility", DISH_VISIBILITIES);

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

export const catalogCollectionEnum = pgEnum("catalog_collection", CATALOG_COLLECTIONS);

/**
 * The Discover catalog (PRD §3.3): curated dishes, fully translated. English
 * is required; French and Arabic fall back to English when missing.
 * Seeded by scripts/seed-catalog.ts.
 */
export const catalogDishes = pgTable(
  "catalog_dishes",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    /** ISO 3166-1 alpha-2, named in the viewer's language with Intl.DisplayNames. */
    country: text("country").notNull(),
    course: courseEnum("course").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    servings: integer("servings").notNull(),
    seasons: seasonEnum("seasons")
      .array()
      .notNull()
      .default(sql`'{}'`),
    dietaryTags: dietaryTagEnum("dietary_tags")
      .array()
      .notNull()
      .default(sql`'{}'`),
    collections: catalogCollectionEnum("collections")
      .array()
      .notNull()
      .default(sql`'{}'`),
    featured: boolean("featured").notNull().default(false),
    photoUrl: text("photo_url"),
    source: text("source").notNull().default("curated"),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr"),
    nameAr: text("name_ar"),
    descriptionEn: text("description_en").notNull(),
    descriptionFr: text("description_fr"),
    descriptionAr: text("description_ar"),
    ...timestamps,
  },
  (t) => [
    index("catalog_dishes_country_idx").on(t.country),
    index("catalog_dishes_course_idx").on(t.course),
    index("catalog_dishes_source_idx").on(t.source),
  ],
);

export const catalogIngredients = pgTable(
  "catalog_ingredients",
  {
    id: id(),
    catalogDishId: uuid("catalog_dish_id")
      .notNull()
      .references(() => catalogDishes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    amount: numeric("amount", { precision: 10, scale: 3, mode: "number" }),
    unit: unitEnum("unit"),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr"),
    nameAr: text("name_ar"),
    noteEn: text("note_en"),
    noteFr: text("note_fr"),
    noteAr: text("note_ar"),
    ...timestamps,
  },
  (t) => [
    index("catalog_ingredients_dish_idx").on(t.catalogDishId, t.position),
    index("catalog_ingredients_ingredient_idx").on(t.ingredientId),
  ],
);

export const catalogSteps = pgTable(
  "catalog_steps",
  {
    id: id(),
    catalogDishId: uuid("catalog_dish_id")
      .notNull()
      .references(() => catalogDishes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    textEn: text("text_en").notNull(),
    textFr: text("text_fr"),
    textAr: text("text_ar"),
    timerSeconds: integer("timer_seconds"),
    ...timestamps,
  },
  (t) => [index("catalog_steps_dish_idx").on(t.catalogDishId, t.position)],
);

/**
 * A dish in someone's recipe box (ARCHITECTURE §4.3).
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
    /** Saved from Discover: the catalog entry it came from. */
    catalogDishId: uuid("catalog_dish_id").references(() => catalogDishes.id, { onDelete: "set null" }),
    /**
     * Until the person edits their copy, a saved Discover dish shows the
     * catalog's text in whatever language they're using (PRD §3.3).
     */
    followsCatalog: boolean("follows_catalog").notNull().default(false),
    /** Who can see it (PRD §3.2). "groups" shares with the groups in dish_groups. */
    visibility: dishVisibilityEnum("visibility").notNull().default("private"),
    /** Copied from a friend's dish: rating the copy rates the original (PRD §3.2). */
    copiedFromDishId: uuid("copied_from_dish_id").references((): AnyPgColumn => dishes.id, { onDelete: "set null" }),
    /** The photo in R2 (`u/{userId}/{uuid}.webp`, plus a `-sm` copy). Never sent to the browser: DTOs carry signed URLs. */
    imageKey: text("image_key"),
    /** Set on delete so Undo can bring the dish back; purged a day later by a job. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("dishes_user_id_idx").on(t.userId, t.deletedAt),
    index("dishes_catalog_dish_id_idx").on(t.catalogDishId),
    index("dishes_copied_from_idx").on(t.copiedFromDishId),
    // A friend's profile lists their shared dishes.
    index("dishes_user_visibility_idx").on(t.userId, t.visibility),
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

/** Where an imported dish came from (PRD §3.2: "the source is credited"). */
export const dishSources = pgTable("dish_sources", {
  dishId: uuid("dish_id")
    .primaryKey()
    .references(() => dishes.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  siteName: text("site_name").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});
