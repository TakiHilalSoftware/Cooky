import { index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ACCENTS, TEXT_SIZES, THEMES } from "@/lib/appearance";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const localeEnum = pgEnum("locale", ["en", "fr", "ar"]);
export const accentEnum = pgEnum("accent", ACCENTS);
export const themeEnum = pgEnum("theme", THEMES);
export const textSizeEnum = pgEnum("text_size", TEXT_SIZES);
export const consentDocumentEnum = pgEnum("consent_document", ["terms", "privacy"]);

/** One row per user. Columns arrive with the phase that uses them. */
export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  locale: localeEnum("locale").notNull().default("en"),
  accent: accentEnum("accent").notNull().default("default"),
  theme: themeEnum("theme").notNull().default("system"),
  textSize: textSizeEnum("text_size").notNull().default("m"),
  ...timestamps,
});

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
