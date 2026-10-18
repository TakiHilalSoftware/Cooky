import { describe, expect, it } from "vitest";

import { monthlyWindowStart, NO_PERIOD, periodEndFor, periodStartFor } from "./periods";

const at = (iso: string) => new Date(iso);

describe("periodStartFor", () => {
  it("counts Free by the UTC calendar month", () => {
    expect(periodStartFor("month", null, at("2026-10-31T23:59:59Z"))).toEqual(at("2026-10-01T00:00:00Z"));
    expect(periodStartFor("month", null, at("2026-11-01T00:00:00Z"))).toEqual(at("2026-11-01T00:00:00Z"));
  });

  it("counts spins by the UTC day", () => {
    expect(periodStartFor("day", null, at("2026-10-18T17:30:00Z"))).toEqual(at("2026-10-18T00:00:00Z"));
  });

  it("keeps one all-time counter for caps and gates", () => {
    expect(periodStartFor("none", at("2026-01-01Z"), at("2026-10-18Z"))).toEqual(NO_PERIOD);
  });

  it("counts paid plans in monthly windows from the billing day", () => {
    const anchor = at("2026-09-15T10:00:00Z");
    expect(periodStartFor("month", anchor, at("2026-10-14T23:00:00Z"))).toEqual(at("2026-09-15T10:00:00Z"));
    expect(periodStartFor("month", anchor, at("2026-10-15T10:00:00Z"))).toEqual(at("2026-10-15T10:00:00Z"));
  });
});

describe("monthlyWindowStart", () => {
  it("gives yearly subscribers monthly allowances", () => {
    const yearlyAnchor = at("2026-01-20T00:00:00Z");
    expect(monthlyWindowStart(yearlyAnchor, at("2026-06-25T00:00:00Z"))).toEqual(at("2026-06-20T00:00:00Z"));
    expect(monthlyWindowStart(yearlyAnchor, at("2026-06-19T00:00:00Z"))).toEqual(at("2026-05-20T00:00:00Z"));
  });

  it("clamps billing days that don't exist in short months", () => {
    const anchor = at("2026-01-31T12:00:00Z");
    expect(monthlyWindowStart(anchor, at("2026-02-28T13:00:00Z"))).toEqual(at("2026-02-28T12:00:00Z"));
    expect(monthlyWindowStart(anchor, at("2026-03-31T12:00:00Z"))).toEqual(at("2026-03-31T12:00:00Z"));
  });

  it("never starts before the anchor", () => {
    const anchor = at("2026-10-18T00:00:00Z");
    expect(monthlyWindowStart(anchor, at("2026-10-01T00:00:00Z"))).toEqual(anchor);
  });
});

describe("periodEndFor", () => {
  it("tells when each window resets", () => {
    expect(periodEndFor("day", at("2026-10-18Z"), null)).toEqual(at("2026-10-19T00:00:00Z"));
    expect(periodEndFor("month", at("2026-12-01Z"), null)).toEqual(at("2027-01-01T00:00:00Z"));
    expect(periodEndFor("month", at("2026-10-15T10:00:00Z"), at("2026-09-15T10:00:00Z"))).toEqual(
      at("2026-11-15T10:00:00Z"),
    );
    expect(periodEndFor("none", at("2026-10-18Z"), null)).toBeNull();
  });
});
