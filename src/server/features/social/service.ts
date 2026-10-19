import "server-only";

import type { Relation } from "@/lib/social";

// Friendship rules (PRD §3.6), pure so they're unit-tested.

/** A declined request stays "Requested" for the sender, who can't re-ask for this long. */
export const DECLINE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
/** Friend requests one person may send per hour. */
export const REQUESTS_PER_HOUR = 20;
export const HOUR_MS = 60 * 60 * 1000;

export type OutgoingRequest = { status: "pending" | "declined"; sentAt: Date; cancelled: boolean } | null;

/**
 * Where `other` stands from the viewer's side. A declined request still reads
 * as "outgoing" during the cooldown, so the sender is never told about it.
 */
export function relationOf(
  input: { isSelf: boolean; isFriend: boolean; outgoing: OutgoingRequest; incomingPending: boolean },
  now: Date,
): Relation {
  if (input.isSelf) return "self";
  if (input.isFriend) return "friend";
  if (input.incomingPending) return "incoming";
  const out = input.outgoing;
  if (out && (out.status === "pending" || (!out.cancelled && inCooldown(out.sentAt, now)))) return "outgoing";
  return "none";
}

export function inCooldown(sentAt: Date, now: Date): boolean {
  return now.getTime() - sentAt.getTime() < DECLINE_COOLDOWN_MS;
}

export type RequestOutcome =
  /** Already friends: nothing to do. */
  | "already_friends"
  /** They had asked you first: sending accepts theirs. */
  | "accept_theirs"
  /** Pending, or declined and still cooling down: looks sent, changes nothing. */
  | "already_requested"
  | "rate_limited"
  | "send";

/** What sending a friend request does. Blocks are checked before this (they look like "not found"). */
export function requestOutcome(input: {
  isFriend: boolean;
  incomingPending: boolean;
  outgoing: OutgoingRequest;
  sentInLastHour: number;
  now: Date;
}): RequestOutcome {
  if (input.isFriend) return "already_friends";
  if (input.incomingPending) return "accept_theirs";
  if (input.outgoing?.status === "pending") return "already_requested";
  if (input.outgoing?.status === "declined" && inCooldown(input.outgoing.sentAt, input.now)) {
    return "already_requested";
  }
  if (input.sentInLastHour >= REQUESTS_PER_HOUR) return "rate_limited";
  return "send";
}

/** `%` and `_` typed into a name search are letters, not wildcards. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
