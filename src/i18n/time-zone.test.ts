import { describe, expect, it } from "vitest";

import { pickTimeZone, resolveTimeZone } from "./time-zone";

describe("resolveTimeZone", () => {
  it.each(["Africa/Casablanca", "Europe/Paris", "Asia/Riyadh", "UTC"])("keeps a real zone (%s)", (zone) => {
    expect(resolveTimeZone(zone)).toBe(zone);
  });

  it.each([undefined, "", "Mars/Olympus", "Europe/Paris; injected"])("falls back to UTC for %j", (zone) => {
    expect(resolveTimeZone(zone)).toBe("UTC");
  });
});

describe("pickTimeZone", () => {
  it("trusts the browser's own zone first (it knows about travel and VPNs)", () => {
    expect(pickTimeZone("Europe/Paris", "Africa/Algiers")).toBe("Europe/Paris");
  });

  it("before the browser has said, uses the zone of the IP address: right from the first page", () => {
    expect(pickTimeZone(undefined, "Africa/Algiers")).toBe("Africa/Algiers");
  });

  it("skips a broken cookie for the IP's zone, and falls back to UTC only without either", () => {
    expect(pickTimeZone("Mars/Olympus", "Africa/Algiers")).toBe("Africa/Algiers");
    expect(pickTimeZone(undefined, null)).toBe("UTC");
    expect(pickTimeZone("", "not a zone")).toBe("UTC");
  });
});
