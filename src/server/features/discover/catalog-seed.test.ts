import { describe, expect, it } from "vitest";

import { CATALOG_COLLECTIONS, COURSES, DIETARY_TAGS, SEASONS, UNITS } from "@/lib/dishes";

import { CATALOG } from "../../../../scripts/seed-catalog";
import { STAPLES } from "../../../../scripts/seed-ingredients";

const texts = (t: { en: string; fr: string; ar: string }) => [t.en, t.fr, t.ar];

describe("the Discover catalog seed", () => {
  it("covers 12+ countries (PRD §3.3) with unique slugs", () => {
    expect(new Set(CATALOG.map((d) => d.country)).size).toBeGreaterThanOrEqual(12);
    const slugs = CATALOG.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const d of CATALOG) expect(d.country).toMatch(/^[A-Z]{2}$/);
  });

  it("is fully translated: every name, description, note and step in EN, FR and AR", () => {
    for (const d of CATALOG) {
      for (const text of [...texts(d.name), ...texts(d.description), ...d.steps.flatMap((s) => texts(s.text))]) {
        expect(text.trim(), d.slug).not.toBe("");
      }
      for (const ing of d.ingredients) {
        if (ing.note) for (const text of texts(ing.note)) expect(text.trim(), d.slug).not.toBe("");
      }
      expect(d.name.ar, d.slug).toMatch(/[؀-ۿ]/);
      expect(
        d.steps.every((s) => /[؀-ۿ]/.test(s.text.ar)),
        d.slug,
      ).toBe(true);
    }
  });

  it("only uses dictionary staples that exist, and names the rest itself", () => {
    const slugs = new Set(STAPLES.map((s) => s.slug));
    for (const d of CATALOG) {
      for (const ing of d.ingredients) {
        if (ing.staple) expect(slugs.has(ing.staple), `${d.slug}: ${ing.staple}`).toBe(true);
        else expect(ing.names, d.slug).toBeDefined();
      }
    }
  });

  it("uses only known courses, diets, seasons, collections and units, and has steps", () => {
    for (const d of CATALOG) {
      expect(COURSES).toContain(d.course);
      for (const tag of d.dietaryTags) expect(DIETARY_TAGS).toContain(tag);
      for (const season of d.seasons) expect(SEASONS).toContain(season);
      for (const c of d.collections) expect(CATALOG_COLLECTIONS).toContain(c);
      for (const ing of d.ingredients) if (ing.unit) expect(UNITS).toContain(ing.unit);
      expect(d.steps.length, d.slug).toBeGreaterThan(0);
      expect(d.ingredients.length, d.slug).toBeGreaterThan(0);
    }
  });

  it("has featured dishes and something in every collection", () => {
    expect(CATALOG.filter((d) => d.featured).length).toBeGreaterThanOrEqual(4);
    for (const c of CATALOG_COLLECTIONS)
      expect(
        CATALOG.some((d) => d.collections.includes(c)),
        c,
      ).toBe(true);
  });
});
