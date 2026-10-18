import { describe, expect, it } from "vitest";

import { AISLES, UNITS } from "@/lib/dishes";

import { STAPLES } from "../../../../scripts/seed-ingredients";

import { allNames, normalize, searchTextFor } from "./service";

describe("the ingredient dictionary seed", () => {
  it("has unique, stable slugs", () => {
    const slugs = STAPLES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("names every entry in English, French and Arabic", () => {
    for (const s of STAPLES) {
      expect(s.nameEn.trim(), s.slug).not.toBe("");
      expect(s.nameFr.trim(), s.slug).not.toBe("");
      expect(s.nameAr, s.slug).toMatch(/[؀-ۿ]/);
    }
  });

  it("never gives one name to two entries, so linking a line is never ambiguous", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const s of STAPLES) {
      for (const name of new Set(allNames(s).map(normalize))) {
        const previous = owner.get(name);
        if (previous && previous !== s.slug) clashes.push(`"${name}": ${previous} / ${s.slug}`);
        owner.set(name, s.slug);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("uses only known aisles and units", () => {
    for (const s of STAPLES) {
      expect(AISLES).toContain(s.aisle);
      if (s.defaultUnit) expect(UNITS).toContain(s.defaultUnit);
    }
  });

  it("indexes every name and variant, normalized, with word starts after a space", () => {
    const tomato = STAPLES.find((s) => s.slug === "tomato")!;
    const search = searchTextFor(tomato);
    expect(search).toContain(" tomatoes ");
    expect(search).toContain(" بندوره ");
    expect(search.startsWith(" ") && search.endsWith(" ")).toBe(true);
  });
});
