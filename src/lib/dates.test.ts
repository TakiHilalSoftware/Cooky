import { describe, expect, it } from "vitest";

import { addDays, addMonths, dayIn, daysBetween, isDay, monthGrid, weekDays, weekStartOf } from "./dates";

describe("dates", () => {
  it("reads today in the person's zone, not the server's", () => {
    const lateEvening = new Date("2026-10-19T23:30:00Z");
    expect(dayIn("UTC", lateEvening)).toBe("2026-10-19");
    expect(dayIn("Europe/Paris", lateEvening)).toBe("2026-10-20");
    expect(dayIn("America/New_York", lateEvening)).toBe("2026-10-19");
  });

  it("counts and shifts whole days across month ends", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("weeks and months", () => {
  it("validates real days only", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-2-3")).toBe(false);
  });

  it("starts weeks on Monday", () => {
    expect(weekStartOf("2026-10-19")).toBe("2026-10-19"); // a Monday
    expect(weekStartOf("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
    expect(weekDays("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("covers a month with whole weeks", () => {
    const grid = monthGrid("2026-10");
    expect(grid[0]).toBe("2026-09-28");
    expect(grid.at(-1)).toBe("2026-11-01");
    expect(grid.length % 7).toBe(0);
    expect(monthGrid("2027-02")).toHaveLength(28); // Feb 2027 starts on a Monday
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});
