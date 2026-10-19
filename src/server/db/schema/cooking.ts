import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { COOK_SOURCES, COURSES, MEAL_SLOTS, SPIN_MODES } from "@/lib/dishes";

import { id, timestamps } from "./_columns";
import { user } from "./auth";
import { aisleEnum, dishes, ingredients, unitEnum } from "./recipes";

/**
 * My kitchen (PRD §3.4): what the person has. Staples ("always have") are
 * never counted as missing. `key` dedupes: the dictionary entry when the name
 * is a known ingredient, otherwise the normalized name.
 */
export const pantryItems = pgTable(
  "pantry_items",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
    /** As the person typed it; shown when the item isn't a dictionary entry. */
    name: text("name").notNull(),
    key: text("key").notNull(),
    isStaple: boolean("is_staple").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("pantry_items_user_key_idx").on(t.userId, t.key),
    index("pantry_items_ingredient_id_idx").on(t.ingredientId),
  ],
);

export const mealSlotEnum = pgEnum("meal_slot", MEAL_SLOTS);
export const cookSourceEnum = pgEnum("cook_source", COOK_SOURCES);

/** What was cooked when (PRD §3.4): recency in Cook, the calendar, and who may rate. */
export const cookLog = pgTable(
  "cook_log",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    /** The person's local calendar day. */
    date: date("date", { mode: "string" }).notNull(),
    mealSlot: mealSlotEnum("meal_slot"),
    source: cookSourceEnum("source").notNull().default("cook"),
    ...timestamps,
  },
  (t) => [index("cook_log_user_date_idx").on(t.userId, t.date), index("cook_log_dish_id_idx").on(t.dishId)],
);

/** 1–5 stars and an optional review, one per person and dish, only after cooking it (PRD §3.2). */
export const dishRatings = pgTable(
  "dish_ratings",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    stars: smallint("stars").notNull(),
    review: text("review"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("dish_ratings_user_dish_idx").on(t.userId, t.dishId),
    index("dish_ratings_dish_id_idx").on(t.dishId),
  ],
);

export const spinModeEnum = pgEnum("spin_mode", SPIN_MODES);

/** Today's spins (PRD §3.4): what was already picked, so the wheel never repeats within a day. */
export const spinSessions = pgTable(
  "spin_sessions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The person's local calendar day. */
    date: date("date", { mode: "string" }).notNull(),
    pickedDishIds: uuid("picked_dish_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    mode: spinModeEnum("mode").notNull().default("random"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** The weekly planner (PRD §3.5): a dish on a day, optionally in a meal slot. The calendar shows these too. */
export const plannedMeals = pgTable(
  "planned_meals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    mealSlot: mealSlotEnum("meal_slot"),
    ...timestamps,
  },
  (t) => [index("planned_meals_user_date_idx").on(t.userId, t.date), index("planned_meals_dish_id_idx").on(t.dishId)],
);

export const eventCourseEnum = pgEnum("event_course", COURSES);

/** A meal for guests (PRD §3.5): a date, a guest count, and one dish per course. */
export const events = pgTable(
  "events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    guests: smallint("guests").notNull(),
    ...timestamps,
  },
  (t) => [index("events_user_date_idx").on(t.userId, t.date)],
);

export const eventDishes = pgTable(
  "event_dishes",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    course: eventCourseEnum("course").notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.eventId, t.course] }), index("event_dishes_dish_id_idx").on(t.dishId)],
);

/**
 * The shopping list (PRD §3.5): one active list per person. `version` goes up
 * on every change, so an offline copy knows when it's stale.
 */
export const shoppingLists = pgTable("shopping_lists", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  ...timestamps,
});

/**
 * One merged line: the same ingredient from several dishes is one item, with
 * amounts summed when the units convert (`key` + `unit_family` identify it).
 */
export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: id(),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    /** mass | volume | the unit itself (piece, clove…) | none. */
    unitFamily: text("unit_family").notNull(),
    amount: numeric("amount", { precision: 12, scale: 3, mode: "number" }),
    unit: unitEnum("unit"),
    aisle: aisleEnum("aisle").notNull().default("other"),
    checked: boolean("checked").notNull().default(false),
    /** When the check last changed: offline replays apply only if newer (last write wins). */
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    sourceDishIds: uuid("source_dish_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    manual: boolean("manual").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("shopping_items_merge_idx").on(t.listId, t.key, t.unitFamily)],
);

/**
 * The Pro iCal feed (PRD §3.5): a secret, revocable URL. Only a hash of the
 * token is kept, so the link is shown once and can't be read back.
 */
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("calendar_feeds_user_idx").on(t.userId)],
);

export const householdStatusEnum = pgEnum("household_status", ["pending", "active"]);

/**
 * The Pro household list (PRD §3.5): people invited to the owner's shopping
 * list. Pending until they accept; it counts only while the owner has Pro.
 */
export const shoppingListMembers = pgTable(
  "shopping_list_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: householdStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] }), index("shopping_list_members_user_idx").on(t.userId)],
);
