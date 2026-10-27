import { describe, expect, it } from "vitest";

import { dailyJitter, pickForYou, scoreCatalog, sortCatalog, type CatalogCandidate, type SuggestContext } from "./service";

const line = (name: string) => ({ name, displayName: name, ingredientId: null });
const have = (...names: string[]) => names.map((name) => ({ names: [name], ingredientId: null }));

function dish(id: string, over: Partial<CatalogCandidate> = {}): CatalogCandidate {
  return {
    id,
    name: id,
    country: "MA",
    seasons: [],
    dietaryTags: [],
    lines: [],
    featured: false,
    translated: true,
    saves: 0,
    saved: false,
    createdAt: new Date("2026-01-01"),
    ...over,
  };
}

const context = (over: Partial<SuggestContext> = {}): SuggestContext => ({
  have: [],
  keyHave: [],
  favoured: ["autumn"],
  mood: "neutral",
  dietaryPrefs: [],
  likedCountries: new Map(),
  seed: "user-1:2026-10-27",
  ...over,
});

describe("dailyJitter", () => {
  it("is stable for a seed, in [0, 1), and changes with the day", () => {
    const today = dailyJitter("dish", "u:2026-10-27");
    expect(dailyJitter("dish", "u:2026-10-27")).toBe(today);
    expect(today).toBeGreaterThanOrEqual(0);
    expect(today).toBeLessThan(1);
    const days = new Set(Array.from({ length: 10 }, (_, d) => dailyJitter("dish", `u:2026-10-${10 + d}`)));
    expect(days.size).toBe(10);
  });
});

describe("pickForYou", () => {
  it("never suggests a dish they saved or one outside their diet", () => {
    const picks = pickForYou(
      [
        dish("saved", { saved: true, dietaryTags: ["halal"] }),
        dish("pork", { dietaryTags: [] }),
        dish("ok", { dietaryTags: ["halal", "vegetarian"] }),
      ],
      context({ dietaryPrefs: ["halal"] }),
      10,
    );
    expect(picks.map((p) => p.id)).toEqual(["ok"]);
  });

  it("puts what they can cook from their kitchen first, and says which ingredients", () => {
    const picks = pickForYou(
      [
        dish("far", { lines: [line("saffron"), line("quince"), line("lamb")] }),
        dish("near", { lines: [line("chicken"), line("lemon"), line("olives")] }),
      ],
      context({ have: have("chicken", "lemon", "olives"), keyHave: have("chicken", "lemon", "olives") }),
      2,
    );
    expect(picks[0]).toEqual({ id: "near", reason: { kind: "have", names: ["chicken", "lemon", "olives"] } });
  });

  it("never names staples as the reason", () => {
    const [pick] = pickForYou(
      [dish("a", { lines: [line("salt"), line("oil"), line("lamb")] })],
      context({ have: have("salt", "oil"), keyHave: [] }),
      1,
    );
    expect(pick?.reason?.kind).not.toBe("have");
  });

  it("ranks by the weather but never repeats it, the season or the diet on every card", () => {
    const stew = dish("stew", { seasons: ["autumn", "winter"], dietaryTags: ["halal"], featured: true });
    const salad = dish("salad", { seasons: ["summer"], dietaryTags: ["halal"] });
    const picks = pickForYou([salad, stew], context({ mood: "cozy", favoured: ["autumn", "winter"], dietaryPrefs: ["halal"] }), 2);
    expect(picks.map((p) => p.id)).toEqual(["stew", "salad"]);
    expect(picks.every((p) => p.reason === null)).toBe(true);
  });

  it("says when a dish is from a cuisine they saved", () => {
    const [pick] = pickForYou([dish("a", { country: "LB" })], context({ likedCountries: new Map([["LB", 2]]) }), 1);
    expect(pick?.reason).toEqual({ kind: "country" });
  });

  it("mixes countries instead of filling the rail with one", () => {
    const moroccan = Array.from({ length: 6 }, (_, i) => dish(`ma-${i}`, { country: "MA", featured: true }));
    const others = [dish("jp", { country: "JP" }), dish("mx", { country: "MX" }), dish("it", { country: "IT" })];
    const picks = pickForYou([...moroccan, ...others], context(), 5);
    const countries = picks.map((p) => p.id.split("-")[0]);
    expect(countries.filter((c) => c === "ma").length).toBeLessThanOrEqual(3);
  });

  it("is the same all day and different another day", () => {
    const catalog = Array.from({ length: 40 }, (_, i) => dish(`d${i}`, { country: `C${i % 8}` }));
    const today = pickForYou(catalog, context(), 10).map((p) => p.id);
    expect(pickForYou(catalog, context(), 10).map((p) => p.id)).toEqual(today);
    expect(pickForYou(catalog, context({ seed: "user-1:2026-10-28" }), 10).map((p) => p.id)).not.toEqual(today);
  });
});

const ids = (list: { id: string }[]) => list.map((d) => d.id);

describe("sortCatalog", () => {
  const catalog = [
    dish("b", { name: "Éclair", createdAt: new Date("2026-03-01"), saves: 1 }),
    dish("a", { name: "Baklava", createdAt: new Date("2026-01-01"), saves: 5 }),
    dish("c", { name: "Couscous", createdAt: new Date("2026-06-01"), featured: true }),
    dish("d", { name: "Dolma", createdAt: new Date("2026-06-01"), translated: false }),
  ];

  it("popular: most saved, then featured, then translated, then newest", () => {
    expect(ids(sortCatalog(catalog, "popular", "en", null))).toEqual(["a", "b", "c", "d"]);
  });

  it("newest first, ties by name", () => {
    expect(ids(sortCatalog(catalog, "newest", "en", null))).toEqual(["c", "d", "b", "a"]);
  });

  it("A–Z by the name the viewer reads, accents ignored", () => {
    expect(ids(sortCatalog(catalog, "name", "fr", null))).toEqual(["a", "c", "d", "b"]);
  });

  it("for you keeps every dish (counts stay honest) but sinks saved and off-diet ones", () => {
    const order = sortCatalog(
      [dish("saved", { saved: true, dietaryTags: ["vegan"] }), dish("meat"), dish("vegan", { dietaryTags: ["vegan"] })],
      "for_you",
      "en",
      context({ dietaryPrefs: ["vegan"] }),
    );
    expect(ids(order)).toEqual(["vegan", "saved", "meat"]);
  });

  it("for you never lets one country fill the first screen", () => {
    const british = Array.from({ length: 12 }, (_, i) => dish(`gb-${i}`, { country: "GB", saves: 50 }));
    const rest = Array.from({ length: 12 }, (_, i) => dish(`x-${i}`, { country: `C${i}` }));
    const first = ids(sortCatalog([...british, ...rest], "for_you", "en", context())).slice(0, 6);
    expect(first.filter((id) => id.startsWith("gb")).length).toBeLessThanOrEqual(3);
  });

  it("falls back to popular when there's no one to rank for", () => {
    expect(sortCatalog(catalog, "for_you", "en", null)).toEqual(sortCatalog(catalog, "popular", "en", null));
    expect(sortCatalog(catalog, "popular", "en", null).every((d) => d.reason === null)).toBe(true);
  });
});

describe("scoreCatalog", () => {
  it("counts the whole kitchen for cookability, staples included", () => {
    const [withStaples] = scoreCatalog(
      [dish("x", { lines: [line("salt"), line("oil")] })],
      context({ have: have("salt", "oil") }),
    );
    const [without] = scoreCatalog([dish("x", { lines: [line("salt"), line("oil")] })], context());
    expect(withStaples!.score).toBeGreaterThan(without!.score);
  });
});
