import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const localeEnum = pgEnum("locale", ["en", "fr", "ar"]);
export const accentEnum = pgEnum("accent", ["default", "peach", "mint", "sky", "lavender", "sand", "rose"]);
export const themeEnum = pgEnum("theme", ["system", "light", "dark"]);
export const textSizeEnum = pgEnum("text_size", ["s", "m", "l", "xl"]);
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
