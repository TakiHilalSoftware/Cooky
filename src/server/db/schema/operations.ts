import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

// Kinds are added by the phase that introduces them (ARCHITECTURE §4.6).
export const outboxKindEnum = pgEnum("outbox_kind", ["email"]);
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
