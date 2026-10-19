import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGETS } from "@/lib/social";

import { id, timestamps } from "./_columns";
import { session, user } from "./auth";
import { dishes } from "./recipes";

// Social (ARCHITECTURE §4.5). A block in either direction keeps two people
// apart everywhere; every read goes through features/social/policy.ts.

export const friendRequestStatusEnum = pgEnum("friend_request_status", ["pending", "declined"]);

/**
 * One row per direction. Accepting turns it into a friendship and removes it;
 * a decline stays, so the sender keeps seeing "Requested" and can't re-ask
 * for 30 days (PRD §3.6).
 */
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: id(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    /** When the request was last sent: the 20-per-hour limit and the 30-day cooldown count from here. */
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * The sender withdrew a request that had already been declined. The row
     * stays so the cooldown still holds (asking again looks sent and changes
     * nothing), but the sender no longer sees it as "Requested".
     */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("friend_requests_pair_idx").on(t.fromUserId, t.toUserId),
    index("friend_requests_to_idx").on(t.toUserId, t.status),
    index("friend_requests_from_sent_idx").on(t.fromUserId, t.sentAt),
  ],
);

/** A friendship, stored once per pair with the smaller id first. */
export const friendships = pgTable(
  "friendships",
  {
    userAId: text("user_a_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.userAId, t.userBId] }),
    index("friendships_user_b_idx").on(t.userBId),
    check("friendships_ordered", sql`${t.userAId} < ${t.userBId}`),
  ],
);

/** Silent: the blocked person is never told, and can't find, add or message the blocker. */
export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("user_blocks_blocked_idx").on(t.blockedId)],
);

/** Private friend lists (Family, Work…) for dish visibility. Members are never told. */
export const friendGroups = pgTable(
  "friend_groups",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("friend_groups_owner_name_idx").on(t.ownerId, sql`lower(${t.name})`)],
);

export const friendGroupMembers = pgTable(
  "friend_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.groupId, t.memberId] }), index("friend_group_members_member_idx").on(t.memberId)],
);

/** The groups a "groups"-visibility dish is shared with. */
export const dishGroups = pgTable(
  "dish_groups",
  {
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => friendGroups.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.dishId, t.groupId] }), index("dish_groups_group_idx").on(t.groupId)],
);

/**
 * A 1:1 chat, once per pair (smaller id first). Kept after an unfriend, read
 * only. Each side archives or clears it independently: clearing hides what
 * came before `cleared_at`, and new messages show again.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userAId: text("user_a_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    archivedByA: boolean("archived_by_a").notNull().default(false),
    archivedByB: boolean("archived_by_b").notNull().default(false),
    clearedAtA: timestamp("cleared_at_a", { withTimezone: true }),
    clearedAtB: timestamp("cleared_at_b", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("conversations_pair_idx").on(t.userAId, t.userBId),
    index("conversations_user_b_idx").on(t.userBId),
    check("conversations_ordered", sql`${t.userAId} < ${t.userBId}`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** An attached dish card; it disappears from the message if the dish goes. */
    dishId: uuid("dish_id").references(() => dishes.id, { onDelete: "set null" }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** Soft delete: the bubble says "Message deleted", the text is wiped. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    index("messages_sender_idx").on(t.senderId),
    index("messages_dish_idx").on(t.dishId),
  ],
);

/** How far each person has read: drives "seen" and the unread dot. */
export const conversationReads = pgTable(
  "conversation_reads",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_reads_user_idx").on(t.userId)],
);

export const reportTargetEnum = pgEnum("report_target", REPORT_TARGETS);
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASONS);
export const reportStatusEnum = pgEnum("report_status", REPORT_STATUSES);

/** Safety reports (PRD §3.6), worked through in the admin reports queue. */
export const reports = pgTable(
  "reports",
  {
    id: id(),
    // Kept (as null) if the reporter's account is purged, so the queue keeps its history.
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_reporter_idx").on(t.reporterId),
    index("reports_resolved_by_idx").on(t.resolvedBy),
    // One open report per person and target: reporting twice doesn't pile up.
    uniqueIndex("reports_open_uniq")
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`${t.status} = 'open'`),
  ],
);

/**
 * Web Push per device. Tied to the session, so revoking a device removes its
 * push subscription too (ARCHITECTURE §4.1).
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** Notifications are written in the device's language. */
    locale: text("locale", { enum: ["en", "fr", "ar"] }).notNull(),
    ...timestamps,
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId), index("push_subscriptions_session_idx").on(t.sessionId)],
);
