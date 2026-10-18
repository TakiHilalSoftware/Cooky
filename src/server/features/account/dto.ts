// What the UI may know about the signed-in account. Types only: safe for the UI.

export type AccountSummaryDto = {
  displayName: string;
  /** One or two letters for the avatar, e.g. "AB". */
  initials: string;
  /** The viewer's own address; never another user's. */
  email: string;
};

/** Up to two initials from the first two words, script-aware (Latin and Arabic). */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toLocaleUpperCase() || "?";
}
