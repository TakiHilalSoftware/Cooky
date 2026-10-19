// One list per admin/ops enum, shared by the DB schema, input schemas and the UI.

export const FEEDBACK_KINDS = ["bug", "feature", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["open", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const DATA_EXPORT_STATUSES = ["queued", "running", "ready", "failed"] as const;
export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

export const FEEDBACK_MESSAGE_MAX = 4000;
/** Admin lists show this many rows per page. */
export const ADMIN_PAGE_SIZE = 25;
/** How long a complimentary plan can be granted for, in months (0 = until revoked). */
export const COMP_MONTHS = [0, 1, 3, 6, 12] as const;
/** The grace period before a deleted account is purged (PRD §3.1). */
export const DELETION_GRACE_DAYS = 7;
