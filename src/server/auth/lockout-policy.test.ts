import { describe, expect, it } from "vitest";

import { lockSecondsAfter } from "./lockout-policy";

describe("lockSecondsAfter", () => {
  it("doesn't lock for the first few mistakes", () => {
    for (const failures of [1, 2, 3, 4, 6, 9, 11, 14]) expect(lockSecondsAfter(failures), String(failures)).toBe(0);
  });

  it("locks progressively longer at 5, 10, 15 and 20 failures", () => {
    expect([5, 10, 15, 20].map(lockSecondsAfter)).toEqual([60, 300, 1800, 7200]);
  });

  it("locks for the longest period on every failure from 20 on", () => {
    expect([21, 25, 100].map(lockSecondsAfter)).toEqual([7200, 7200, 7200]);
  });
});
