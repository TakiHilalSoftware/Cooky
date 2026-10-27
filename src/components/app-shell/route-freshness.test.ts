import { describe, expect, it } from "vitest";

import { PAGE_CACHE_SECONDS } from "@/lib/page-cache";

import { arrival } from "./route-freshness";

const NOW = 10_000_000;
const MINUTE = 60_000;
const WINDOW = PAGE_CACHE_SECONDS * 1000;

describe("arrival", () => {
  it("records a first visit as rendered now, with nothing to refresh", () => {
    expect(arrival(undefined, NOW, false)).toEqual({ refresh: false, renderedAt: NOW });
    expect(arrival(undefined, NOW, true)).toEqual({ refresh: false, renderedAt: NOW });
  });

  it("shows a page kept from the last minute as is: it is as old as that visit", () => {
    const recent = NOW - 20_000;
    expect(arrival(recent, NOW, false)).toEqual({ refresh: false, renderedAt: recent });
    expect(arrival(recent, NOW, true)).toEqual({ refresh: false, renderedAt: recent });
  });

  it("refreshes an older kept page reached by a link, behind the page", () => {
    expect(arrival(NOW - 2 * MINUTE, NOW, false)).toEqual({ refresh: true, renderedAt: NOW });
    expect(arrival(NOW - WINDOW + 1, NOW, false)).toEqual({ refresh: true, renderedAt: NOW });
  });

  it("knows a link past the cache window was fetched anew, so there is nothing to refresh", () => {
    expect(arrival(NOW - WINDOW, NOW, false)).toEqual({ refresh: false, renderedAt: NOW });
    expect(arrival(NOW - 3 * WINDOW, NOW, false)).toEqual({ refresh: false, renderedAt: NOW });
  });

  it("never refreshes a page arriving under its skeleton: it is already being fetched anew", () => {
    expect(arrival(NOW - 2 * MINUTE, NOW, false, true)).toEqual({ refresh: false, renderedAt: NOW });
    expect(arrival(NOW - 2 * MINUTE, NOW, true, true)).toEqual({ refresh: false, renderedAt: NOW });
  });

  it("refreshes an old page brought back by Back/Forward, however old", () => {
    expect(arrival(NOW - 2 * MINUTE, NOW, true)).toEqual({ refresh: true, renderedAt: NOW });
    expect(arrival(NOW - 3 * WINDOW, NOW, true)).toEqual({ refresh: true, renderedAt: NOW });
  });
});
