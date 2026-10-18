import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { COURSES, DIETARY_TAGS, DIFFICULTIES, SEASONS, UNITS } from "@/lib/dishes";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const difficultyEnum = pgEnum("difficulty", DIFFICULTIES);
export const courseEnum = pgEnum("course", COURSES);
export const seasonEnum = pgEnum("season", SEASONS);
export const dietaryTagEnum = pgEnum("dietary_tag", DIETARY_TAGS);
export const unitEnum = pgEnum("unit", UNITS);

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
    ...timestamps,
  },
  (t) => [index("dish_ingredients_dish_id_idx").on(t.dishId, t.position)],
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
