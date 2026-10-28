import { describe, expect, it } from "vitest";

import {
  ALMOST_MAX_MISSING,
  isHad,
  rankDishes,
  splitReady,
  type HaveItem,
  type RankableDish,
  type RankLine,
} from "./service";

const line = (name: string, ingredientId: string | null = null): RankLine => ({
  name,
  displayName: name,
  ingredientId,
});
const have = (...names: string[]): HaveItem[] => names.map((name) => ({ names: [name], ingredientId: null }));

const dish = (id: string, lines: RankLine[], overrides: Partial<RankableDish> = {}): RankableDish => ({
  id,
  seasons: [],
  dietaryTags: [],
  lines,
  lastCooked: null,
  ...overrides,
});

const context = {
  have: [] as HaveItem[],
  favoured: ["autumn", "winter"] as const,
  dietaryPrefs: [],
  today: "2026-10-19",
};
const ids = (ranked: { id: string }[]) => ranked.map((r) => r.id);

describe("isHad", () => {
  it("matches by dictionary entry when both are linked, so look-alikes don't count", () => {
    expect(isHad(line("طحين", "flour"), [{ names: ["طحينة"], ingredientId: "tahini" }])).toBe(false);
    expect(isHad(line("Tomates", "tomato"), [{ names: ["tomato"], ingredientId: "tomato" }])).toBe(true);
  });

  it("otherwise every word of what you have must match the line", () => {
    expect(isHad(line("Chicken thighs"), have("chicken"))).toBe(true);
    expect(isHad(line("Chicken"), have("chicken thighs"))).toBe(false);
    expect(isHad(line("Boiled eggs"), have("oil"))).toBe(false);
  });
});

describe("rankDishes", () => {
  it("puts the dish with the fewest missing ingredients first and lists what's missing", () => {
    const ranked = rankDishes(
      [dish("soup", [line("Lentils"), line("Onion"), line("Cumin")]), dish("omelette", [line("Eggs"), line("Salt")])],
      { ...context, have: have("eggs", "salt", "onion") },
    );
    expect(ids(ranked)).toEqual(["omelette", "soup"]);
    expect(ranked[0]?.missing).toEqual([]);
    expect(ranked[1]?.missing).toEqual(["Lentils", "Cumin"]);
  });

  it("breaks ties by weather fit: the right season, then no season, then another season", () => {
    const ranked = rankDishes(
      [
        dish("salad", [line("Lettuce")], { seasons: ["summer"] }),
        dish("bread", [line("Flour")]),
        dish("stew", [line("Beef")], { seasons: ["winter"] }),
      ],
      context,
    );
    expect(ids(ranked)).toEqual(["stew", "bread", "salad"]);
  });

  it("puts what's planned for the meal first, even when it's missing something", () => {
    const ranked = rankDishes([dish("omelette", [line("Eggs")]), dish("tagine", [line("Chicken"), line("Olives")])], {
      ...context,
      have: have("eggs"),
      meal: { planned: new Set(["tagine"]), usual: new Map() },
    });
    expect(ids(ranked)).toEqual(["tagine", "omelette"]);
    expect(ranked[0]).toMatchObject({ planned: true, missing: ["Chicken", "Olives"] });
  });

  it("then lifts what the person usually has at that meal, above the weather", () => {
    const ranked = rankDishes(
      [
        dish("stew", [line("Beef")], { seasons: ["winter"] }),
        dish("once", [line("Rice")]),
        dish("often", [line("Bread")]),
      ],
      {
        ...context,
        meal: {
          planned: new Set(),
          usual: new Map([
            ["often", 4],
            ["once", 1],
          ]),
        },
      },
    );
    expect(ids(ranked)).toEqual(["often", "once", "stew"]);
    expect(ranked.map((r) => r.usualCount)).toEqual([4, 1, 0]);
  });

  it("never lets a habit beat fewer missing ingredients", () => {
    const ranked = rankDishes([dish("habit", [line("Lamb")]), dish("ready", [line("Eggs")])], {
      ...context,
      have: have("eggs"),
      meal: { planned: new Set(), usual: new Map([["habit", 9]]) },
    });
    expect(ids(ranked)).toEqual(["ready", "habit"]);
  });

  it("without a meal, nothing is planned or usual", () => {
    const [only] = rankDishes([dish("soup", [line("Lentils")])], context);
    expect(only).toMatchObject({ planned: false, usualCount: 0 });
  });

  it("then dietary fit", () => {
    const ranked = rankDishes(
      [dish("kebab", [line("Lamb")]), dish("falafel", [line("Chickpeas")], { dietaryTags: ["vegetarian", "vegan"] })],
      { ...context, dietaryPrefs: ["vegetarian"] },
    );
    expect(ids(ranked)).toEqual(["falafel", "kebab"]);
    expect(ranked.map((r) => r.dietFit)).toEqual([true, false]);
  });

  it("then moves dishes cooked in the last three days down, and long-forgotten ones up", () => {
    const ranked = rankDishes(
      [
        dish("yesterday", [line("Rice")], { lastCooked: "2026-10-18" }),
        dish("never", [line("Rice")]),
        dish("two-months", [line("Rice")], { lastCooked: "2026-08-15" }),
      ],
      context,
    );
    expect(ids(ranked)).toEqual(["two-months", "never", "yesterday"]);
    expect(ranked.find((r) => r.id === "yesterday")?.daysSinceCooked).toBe(1);
  });

  it("missing ingredients outweigh everything else", () => {
    const ranked = rankDishes(
      [
        dish("perfect-but-missing", [line("Beef"), line("Carrots")], { seasons: ["winter"] }),
        dish("ready", [line("Eggs")], { seasons: ["summer"], lastCooked: "2026-10-19" }),
      ],
      { ...context, have: have("eggs") },
    );
    expect(ids(ranked)).toEqual(["ready", "perfect-but-missing"]);
  });

  it("counts a repeated ingredient once", () => {
    const [ranked] = rankDishes([dish("tagine", [line("Onion"), line("onion"), line("Saffron")])], context);
    expect(ranked?.missing).toEqual(["Onion", "Saffron"]);
  });
});

describe("splitReady", () => {
  const ranked = (missing: number[]) => missing.map((n, i) => ({ id: `d${i}`, missing: Array(n).fill("x") }));

  it("puts what's makeable now apart from what's one or two short, and drops the rest", () => {
    const split = splitReady(ranked([0, 0, 1, 2, 3, 5]), 10);
    expect(ids(split.ready)).toEqual(["d0", "d1"]);
    expect(ids(split.almost)).toEqual(["d2", "d3"]);
    expect(ALMOST_MAX_MISSING).toBe(2);
  });

  it("caps each list but counts every dish, so “+n more” stays honest", () => {
    const split = splitReady(ranked([0, 0, 0, 1, 1, 1, 1]), 2);
    expect(split.ready).toHaveLength(2);
    expect(split.almost).toHaveLength(2);
    expect(split.readyCount).toBe(3);
    expect(split.almostCount).toBe(4);
  });

  it("keeps the ranking order", () => {
    const split = splitReady(
      [
        { id: "b", missing: ["x"] },
        { id: "a", missing: [] },
        { id: "c", missing: ["y"] },
      ],
      5,
    );
    expect(ids(split.almost)).toEqual(["b", "c"]);
  });
});
