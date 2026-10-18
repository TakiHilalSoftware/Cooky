import { describe, expect, it } from "vitest";

import { resolveTimeZone } from "./time-zone";

describe("resolveTimeZone", () => {
  it.each(["Africa/Casablanca", "Europe/Paris", "Asia/Riyadh", "UTC"])("keeps a real zone (%s)", (zone) => {
    expect(resolveTimeZone(zone)).toBe(zone);
  });

  it.each([undefined, "", "Mars/Olympus", "Europe/Paris; injected"])("falls back to UTC for %j", (zone) => {
    expect(resolveTimeZone(zone)).toBe("UTC");
  });
});
