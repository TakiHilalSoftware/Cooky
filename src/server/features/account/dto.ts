// What the UI may know about the signed-in account. Types only: safe for the UI.

export type AccountSummaryDto = {
  displayName: string;
  /** One or two letters for the avatar, e.g. "AB". */
  initials: string;
  /** The viewer's own address; never another user's. */
  email: string;
};
