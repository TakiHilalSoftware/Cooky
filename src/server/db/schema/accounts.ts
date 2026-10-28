import { sql } from "drizzle-orm";
import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ACCENTS, TEXT_SIZES, THEMES } from "@/lib/appearance";
import { DEFAULT_MEAL_TIMES, type MealTimes } from "@/lib/meal-times";
import { NOTIFICATION_KINDS } from "@/lib/social";

import { id, timestamps } from "./_columns";
import { user } from "./auth";
import { dietaryTagEnum } from "./recipes";

export const localeEnum = pgEnum("locale", ["en", "fr", "ar"]);
export const accentEnum = pgEnum("accent", ACCENTS);
export const themeEnum = pgEnum("theme", THEMES);
export const textSizeEnum = pgEnum("text_size", TEXT_SIZES);
export const consentDocumentEnum = pgEnum("consent_document", ["terms", "privacy"]);

/** One row per user. Columns arrive with the phase that uses them. */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    /** Profile photo in R2, square. DTOs carry a signed URL, never the key. */
    avatarKey: text("avatar_key"),
    locale: localeEnum("locale").notNull().default("en"),
    accent: accentEnum("accent").notNull().default("default"),
    theme: themeEnum("theme").notNull().default("system"),
    textSize: textSizeEnum("text_size").notNull().default("m"),
    /** Where they cook, for the weather and seasons (Phase 4). */
    city: text("city"),
    /** Rounded to ~1 km (2 decimals): enough for the weather, not a home address. */
    latitude: numeric("latitude", { precision: 5, scale: 2, mode: "number" }),
    longitude: numeric("longitude", { precision: 5, scale: 2, mode: "number" }),
    dietaryPrefs: dietaryTagEnum("dietary_prefs")
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** When they usually eat, in minutes after midnight (null: they skip that meal). Cook suggests for the next one. */
    mealTimes: jsonb("meal_times").$type<MealTimes>().notNull().default(DEFAULT_MEAL_TIMES),
    /** Set when the starter pack is finished or skipped. */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** Notification types switched off (PRD §3.6); empty = everything on. */
    notificationsOff: text("notifications_off", { enum: NOTIFICATION_KINDS })
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** The first-week checklist was hidden by the person (PRD §3.1). */
    checklistDismissedAt: timestamp("checklist_dismissed_at", { withTimezone: true }),
    /** Last visit to Friends: newer incoming requests show the badge. */
    friendsSeenAt: timestamp("friends_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  // Friends search matches display names, typo-tolerant.
  (t) => [index("profiles_display_name_trgm_idx").using("gin", sql`${t.displayName} gin_trgm_ops`)],
);

/** Which version of the terms/privacy policy a user accepted, and when (PRD §3.1). */
export const consents = pgTable(
  "consents",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document: consentDocumentEnum("document").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("consents_user_id_idx").on(t.userId)],
);

export type ProfileRow = typeof profiles.$inferSelect;

/**
 * Failed password logins per email, for progressive lockout (PRD §3.1). Keyed
 * by a keyed hash of the email: no address is stored, and rows exist for
 * unknown emails too, so lockout behaves the same whether an account exists.
 */
export const loginAttempts = pgTable("login_attempts", {
  emailKey: text("email_key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});
