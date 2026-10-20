import { describe, expect, it } from "vitest";

import { PAGE_CACHE_SECONDS } from "@/lib/page-cache";

import { arrival } from "./route-freshness";

const NOW = 10_000_000;
const MINUTE = 60_000;

describe("arrival", () => {
  it("records a first visit as rendered now, with nothing to refresh", () => {
    expect(arrival(undefined, NOW, false)).toEqual({ refresh: false, renderedAt: NOW });
    expect(arrival(undefined, NOW, true)).toEqual({ refresh: false, renderedAt: NOW });
  });

  it("shows a page kept from a recent visit as is: it is as old as that visit", () => {
    const seen = NOW - 2 * MINUTE;
    expect(arrival(seen, NOW, false)).toEqual({ refresh: false, renderedAt: seen });
  });

  it("knows a page past the cache window was fetched anew", () => {
    const seen = NOW - PAGE_CACHE_SECONDS * 1000 - 1;
    expect(arrival(seen, NOW, false)).toEqual({ refresh: false, renderedAt: NOW });
  });

  it("refreshes an old page brought back by Back/Forward, and leaves a recent one alone", () => {
    expect(arrival(NOW - 2 * MINUTE, NOW, true)).toEqual({ refresh: true, renderedAt: NOW });
    expect(arrival(NOW - 3 * 60 * MINUTE, NOW, true)).toEqual({ refresh: true, renderedAt: NOW });
    const recent = NOW - 20_000;
    expect(arrival(recent, NOW, true)).toEqual({ refresh: false, renderedAt: recent });
  });
});
