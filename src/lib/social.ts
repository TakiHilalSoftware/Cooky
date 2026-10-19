// One list per social enum, shared by the DB schema, input schemas and the UI.

/** Who can see a dish (PRD §3.2): only me, all my friends, or chosen groups. */
export const DISH_VISIBILITIES = ["private", "friends", "groups"] as const;
export type DishVisibility = (typeof DISH_VISIBILITIES)[number];

export const REPORT_TARGETS = ["user", "dish", "message", "review"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Notification types a person can switch off (PRD §3.6). Everything is on until they do. */
export const NOTIFICATION_KINDS = ["messages", "friend_requests", "friend_accepted", "timers", "billing"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Where someone stands with the viewer, from the viewer's side. */
export const RELATIONS = ["self", "none", "friend", "outgoing", "incoming"] as const;
export type Relation = (typeof RELATIONS)[number];

export const MESSAGE_MAX = 4000;
export const GROUP_NAME_MAX = 40;
export const REPORT_DETAILS_MAX = 1000;
/** Older messages load this many at a time (PRD §3.6). */
export const MESSAGE_PAGE_SIZE = 50;
/** A friend's shared dishes, per page. */
export const FRIEND_DISHES_PAGE_SIZE = 24;

/** The one Pusher event name on a person's private channel; the payload says what happened. */
export const REALTIME_EVENT_NAME = "cooky";
