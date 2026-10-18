import { describe, expect, it } from "vitest";

import { filterByIngredients, matches, normalize, words } from "./service";

describe("normalize", () => {
  it("folds case and accents", () => {
    expect(normalize("Crème Fraîche")).toBe("creme fraiche");
    expect(normalize("PIMENT D'ESPELETTE")).toBe("piment d espelette");
    expect(normalize("œufs")).toBe("oeufs");
  });

  it("unifies Arabic letter forms and drops diacritics and tatweel", () => {
    expect(normalize("أرز")).toBe(normalize("ارز"));
    expect(normalize("إجاص")).toBe("اجاص");
    expect(normalize("طماطة")).toBe("طماطه");
    expect(normalize("حلوى")).toBe("حلوي");
    expect(normalize("سُكَّر")).toBe("سكر");
    expect(normalize("بـــصل")).toBe("بصل");
  });

  it("strips the article ال from longer words only", () => {
    expect(normalize("الطماطم")).toBe("طماطم");
    expect(normalize("الحمص")).toBe("حمص");
    // Too short: "ال" here is part of the word, not an article.
    expect(normalize("الف")).toBe("الف");
  });

  it("splits on punctuation and spaces", () => {
    expect(words("Tomatoes, peeled (canned)")).toEqual(["tomatoes", "peeled", "canned"]);
    expect(words("  ")).toEqual([]);
  });
});

describe("matches", () => {
  it("matches plurals and short forms by prefix, both ways", () => {
    expect(matches("Potatoes", "potato")).toBe(true);
    expect(matches("potato", "Potatoes")).toBe(true);
    expect(matches("pommes de terre", "pomme")).toBe(true);
  });

  it("needs every wanted word, in any order", () => {
    expect(matches("Chicken breast", "chicken")).toBe(true);
    expect(matches("Boneless chicken thighs", "chicken thigh")).toBe(true);
    expect(matches("Chicken", "chicken breast")).toBe(false);
  });

  it("short words must match exactly: 'oil' never matches 'boiled'", () => {
    expect(matches("boiled eggs", "oil")).toBe(false);
    expect(matches("olive oil", "oil")).toBe(true);
    expect(matches("an egg", "eg")).toBe(false);
  });

  it("matches across accents and Arabic forms", () => {
    expect(matches("Pâte feuilletée", "pate feuilletee")).toBe(true);
    expect(matches("الطماطم المقشرة", "طماطم")).toBe(true);
    expect(matches("حمص مسلوق", "الحمص")).toBe(true);
    expect(matches("أرز بسمتي", "ارز")).toBe(true);
  });

  it("nothing wanted matches nothing", () => {
    expect(matches("salt", "")).toBe(false);
    expect(matches("salt", " , ")).toBe(false);
  });
});

describe("filterByIngredients", () => {
  const dishes = [
    { name: "Tagine", ingredients: ["Chicken thighs", "Green olives", "Preserved lemon"] },
    { name: "Soup", ingredients: ["Lentils", "Carrots", "Cumin"] },
    { name: "Salad", ingredients: ["Tomatoes", "Olive oil", "Lemon juice"] },
  ];
  const of = (d: (typeof dishes)[number]) => d.ingredients;
  const names = (r: { items: typeof dishes }) => r.items.map((d) => d.name);

  it("prefers dishes that use all the wanted ingredients", () => {
    const result = filterByIngredients(dishes, of, ["lemon", "olive"]);
    expect(result.mode).toBe("all");
    expect(names(result)).toEqual(["Tagine", "Salad"]);
  });

  it("falls back to any, and says so", () => {
    const result = filterByIngredients(dishes, of, ["lentil", "chicken"]);
    expect(result.mode).toBe("any");
    expect(names(result)).toEqual(["Tagine", "Soup"]);
  });

  it("none when nothing matches at all", () => {
    expect(filterByIngredients(dishes, of, ["saffron"])).toEqual({ mode: "none", items: [] });
  });

  it("an empty wish list keeps everything", () => {
    expect(filterByIngredients(dishes, of, ["", "  "]).items).toHaveLength(3);
  });
});
