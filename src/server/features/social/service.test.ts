import { describe, expect, it } from "vitest";

import { DECLINE_COOLDOWN_MS, escapeLike, relationOf, requestOutcome, REQUESTS_PER_HOUR } from "./service";

const now = new Date("2026-10-19T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const base = { isSelf: false, isFriend: false, outgoing: null, incomingPending: false };

describe("relationOf", () => {
  it("knows yourself and your friends", () => {
    expect(relationOf({ ...base, isSelf: true }, now)).toBe("self");
    expect(relationOf({ ...base, isFriend: true }, now)).toBe("friend");
  });

  it("shows their request to you before your own", () => {
    expect(
      relationOf(
        { ...base, incomingPending: true, outgoing: { status: "pending", sentAt: now, cancelled: false } },
        now,
      ),
    ).toBe("incoming");
  });

  it("keeps a declined request looking 'Requested' to the sender for 30 days, then lets go", () => {
    const declined = (ms: number) => ({
      ...base,
      outgoing: { status: "declined" as const, sentAt: ago(ms), cancelled: false },
    });
    expect(relationOf(declined(DECLINE_COOLDOWN_MS - 1000), now)).toBe("outgoing");
    expect(relationOf(declined(DECLINE_COOLDOWN_MS + 1000), now)).toBe("none");
  });

  it("hides a withdrawn declined request from its sender", () => {
    const outgoing = { status: "declined" as const, sentAt: ago(1000), cancelled: true };
    expect(relationOf({ ...base, outgoing }, now)).toBe("none");
  });

  it("keeps a pending request outgoing however old", () => {
    expect(
      relationOf(
        { ...base, outgoing: { status: "pending", sentAt: ago(DECLINE_COOLDOWN_MS * 3), cancelled: false } },
        now,
      ),
    ).toBe("outgoing");
  });
});

describe("requestOutcome", () => {
  const send = { isFriend: false, incomingPending: false, outgoing: null, sentInLastHour: 0, now };

  it("sends a fresh request", () => {
    expect(requestOutcome(send)).toBe("send");
  });

  it("accepts their pending request instead of crossing it with a new one", () => {
    expect(requestOutcome({ ...send, incomingPending: true })).toBe("accept_theirs");
  });

  it("changes nothing during the decline cooldown, and lets them ask again after it", () => {
    const declinedAt = (ms: number) => ({
      ...send,
      outgoing: { status: "declined" as const, sentAt: ago(ms), cancelled: false },
    });
    expect(requestOutcome(declinedAt(DECLINE_COOLDOWN_MS / 2))).toBe("already_requested");
    expect(requestOutcome(declinedAt(DECLINE_COOLDOWN_MS + 1))).toBe("send");
  });

  it("keeps the cooldown after the sender withdrew a declined request", () => {
    const outgoing = { status: "declined" as const, sentAt: ago(1000), cancelled: true };
    expect(requestOutcome({ ...send, outgoing })).toBe("already_requested");
  });

  it("stops at 20 requests an hour", () => {
    expect(requestOutcome({ ...send, sentInLastHour: REQUESTS_PER_HOUR - 1 })).toBe("send");
    expect(requestOutcome({ ...send, sentInLastHour: REQUESTS_PER_HOUR })).toBe("rate_limited");
  });

  it("doesn't count a resend of a pending request against the limit", () => {
    expect(
      requestOutcome({
        ...send,
        outgoing: { status: "pending", sentAt: now, cancelled: false },
        sentInLastHour: REQUESTS_PER_HOUR,
      }),
    ).toBe("already_requested");
  });

  it("does nothing between friends", () => {
    expect(requestOutcome({ ...send, isFriend: true, incomingPending: true })).toBe("already_friends");
  });
});

describe("escapeLike", () => {
  it("treats wildcards as plain letters", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
