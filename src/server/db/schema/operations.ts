import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { DATA_EXPORT_STATUSES, FEEDBACK_KINDS, FEEDBACK_STATUSES } from "@/lib/admin";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

// Kinds are added by the phase that introduces them (ARCHITECTURE §4.6).
export const outboxKindEnum = pgEnum("outbox_kind", [
  "email",
  "backup_import",
  "push",
  "pusher",
  "data_export",
  "stripe_cancel",
  "account_purge",
]);
export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "done", "dead"]);

/**
 * Transactional outbox: side effects are written next to the data change and
 * delivered by the drain worker with retries (ARCHITECTURE §5.12).
 */
export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    kind: outboxKindEnum("kind").notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [index("outbox_due_idx").on(t.status, t.runAfter)],
);

/** Every admin action and sensitive user action (PRD §3.8). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    // Kept (as null) when the actor's account is purged, so the trail survives.
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta"),
    ipHash: text("ip_hash"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("audit_log_actor_id_idx").on(t.actorId), index("audit_log_at_idx").on(t.at)],
);

export type OutboxRow = typeof outbox.$inferSelect;

export const feedbackKindEnum = pgEnum("feedback_kind", FEEDBACK_KINDS);
export const feedbackStatusEnum = pgEnum("feedback_status", FEEDBACK_STATUSES);

/** Settings → Help & feedback (PRD §3.8), worked through in the admin panel. */
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    // Kept (as null) when the account is purged: the message may still matter.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    kind: feedbackKindEnum("kind").notNull(),
    message: text("message").notNull(),
    locale: text("locale").notNull(),
    userAgent: text("user_agent"),
    status: feedbackStatusEnum("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("feedback_status_idx").on(t.status, t.createdAt), index("feedback_user_idx").on(t.userId, t.createdAt)],
);

export const dataExportStatusEnum = pgEnum("data_export_status", DATA_EXPORT_STATUSES);

/**
 * A full data export (PRD §3.1), built by an outbox job and downloadable for
 * a day through a signed link. The file lives in R2 under the owner's prefix;
 * `content` holds it only when storage isn't set up (local development).
 */
export const dataExports = pgTable(
  "data_exports",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: dataExportStatusEnum("status").notNull().default("queued"),
    objectKey: text("object_key"),
    content: text("content"),
    sizeBytes: integer("size_bytes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("data_exports_user_idx").on(t.userId, t.createdAt), index("data_exports_expires_idx").on(t.expiresAt)],
);
