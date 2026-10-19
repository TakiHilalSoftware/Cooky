import { index, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { user } from "./auth";

export const assistantRoleEnum = pgEnum("assistant_role", ["user", "assistant"]);

/** One conversation with the Assistant (PRD §3.4). History older than 90 days is pruned. */
export const assistantThreads = pgTable(
  "assistant_threads",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The first question, shortened: how the thread is listed. */
    title: text("title").notNull(),
    ...timestamps,
  },
  (t) => [index("assistant_threads_user_idx").on(t.userId, t.updatedAt)],
);

/** A saved pick: enough to show the card again without asking the model. */
export type AssistantPick =
  { kind: "mine"; dishId: string; why: string } | { kind: "discover"; slug: string; why: string };

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: id(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => assistantThreads.id, { onDelete: "cascade" }),
    role: assistantRoleEnum("role").notNull(),
    content: text("content").notNull(),
    picks: jsonb("picks").$type<AssistantPick[]>().notNull().default([]),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    ...timestamps,
  },
  (t) => [index("assistant_messages_thread_idx").on(t.threadId, t.createdAt)],
);
