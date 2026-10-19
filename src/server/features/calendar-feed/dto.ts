// What the UI may know about the calendar feed. Types only: safe for the UI.

export type CalendarFeedDto = {
  /** The plan includes the feed (Pro). */
  available: boolean;
  /** A feed link exists (its secret is never shown again after creation). */
  active: boolean;
  createdAt: string | null;
};
