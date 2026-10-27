import { describe, expect, it } from "vitest";

import {
  courseFor,
  describe as describeDish,
  inferDietaryTags,
  parseMeasure,
  parseSteps,
  sameName,
  seasonsFor,
  slugify,
} from "../../../../scripts/mealdb-parse";

describe("TheMealDB import", () => {
  describe("dietary tags only claim what the ingredients prove", () => {
    it("never calls meat halal: how it was slaughtered isn't in a recipe", () => {
      expect(inferDietaryTags(["Chicken thighs", "Lemon"])).not.toContain("halal");
      expect(inferDietaryTags(["Lamb", "Cumin"])).toEqual([]);
    });

    it("never calls a dish with alcohol halal, even without meat", () => {
      expect(inferDietaryTags(["Mushrooms", "White wine", "Rice"])).toEqual(["vegan", "vegetarian"]);
      expect(inferDietaryTags(["Cream", "Brandy"])).toEqual(["vegetarian"]);
    });

    it("tells vegan, vegetarian and pescatarian apart", () => {
      expect(inferDietaryTags(["Chickpeas", "Tahini", "Lemon"])).toEqual(["vegan", "vegetarian", "halal"]);
      expect(inferDietaryTags(["Spinach", "Feta"])).toEqual(["vegetarian", "halal"]);
      expect(inferDietaryTags(["Salmon", "Dill"])).toEqual(["pescatarian", "halal"]);
      // Hidden fish: Worcestershire sauce is made with anchovies.
      expect(inferDietaryTags(["Mushrooms", "Worcestershire Sauce"])).toEqual(["pescatarian", "halal"]);
    });

    it("matches whole words: eggplant isn't egg, ginger isn't gin, kidney beans aren't kidneys", () => {
      expect(inferDietaryTags(["Eggplant", "Ginger", "Kidney Beans"])).toEqual(["vegan", "vegetarian", "halal"]);
      expect(inferDietaryTags(["Lamb Kidneys"])).toEqual([]);
    });

    it("never guesses allergen-free tags", () => {
      const tags = inferDietaryTags(["Rice", "Water"]);
      for (const allergen of ["gluten_free", "dairy_free", "nut_free", "egg_free"] as const) {
        expect(tags).not.toContain(allergen);
      }
    });
  });

  it("keeps accents in slugs as letters, and spots duplicates of curated dishes", () => {
    expect(slugify("Classic Tourtière")).toBe("classic-tourtiere");
    expect(slugify("Turkey Bánh mì")).toBe("turkey-banh-mi");
    expect(slugify("Polish doughnuts (Pączki)")).toBe("polish-doughnuts-paczki");
    expect(slugify("Corned Beef and Cabbage – Jamaican Style")).toBe("corned-beef-and-cabbage-jamaican-style");
    expect(sameName("Koshari", "koshari")).toBe(true);
    expect(sameName("Shakshuka", "Shakshouka")).toBe(false);
  });

  it("maps categories to courses (breakfast is a meal, not a starter)", () => {
    expect(courseFor("Dessert")).toBe("dessert");
    expect(courseFor("Starter")).toBe("appetizer");
    expect(courseFor("Side")).toBe("side");
    expect(courseFor("Breakfast")).toBe("main");
    expect(courseFor(null)).toBe("main");
  });

  it("gives seasons only when the dish says so", () => {
    expect(seasonsFor("Harira soup", "Soup")).toEqual(["autumn", "winter"]);
    expect(seasonsFor("Greek salad", "Vegetarian")).toEqual(["spring", "summer"]);
    expect(seasonsFor("Lasagne", "Pasta")).toEqual([]);
  });

  it("describes a dish by what's distinctive in it, with no marketing words", () => {
    expect(describeDish("Tunisian", "Vegetarian", ["Olive Oil", "Onion", "Chickpeas", "Harissa", "Cumin"], ["vegan"])).toBe(
      "A Tunisian vegan dish with chickpeas, harissa and cumin.",
    );
    expect(describeDish("Indian", "Dessert", ["Milk", "Rice"], [])).toBe("An Indian dessert with milk and rice.");
    expect(describeDish("Irish", "Beef", ["Salt", "Water"], [])).toBe("An Irish dish.");
  });

  it("splits a measure into amount, unit and a note that never repeats them", () => {
    expect(parseMeasure("1 1/2 tbsp chopped")).toEqual({ amount: 1.5, unit: "tbsp", note: "chopped" });
    expect(parseMeasure("500g")).toEqual({ amount: 500, unit: "g", note: null });
    expect(parseMeasure("2 large")).toEqual({ amount: 2, unit: null, note: "large" });
    expect(parseMeasure("To taste")).toEqual({ amount: null, unit: null, note: "to taste" });
    expect(parseMeasure("1 garlic bulb")).toEqual({ amount: 1, unit: null, note: "garlic bulb" });
    expect(parseMeasure("")).toEqual({ amount: null, unit: null, note: null });
  });

  it("splits instructions into steps with timers", () => {
    const steps = parseSteps("STEP 1\r\nHeat the oil.\r\n\r\nSTEP 2\r\nSimmer for 20-25 minutes until thick.\r\n\r\nRest 1 hour.");
    expect(steps).toEqual([
      { text: "Heat the oil.", timerSeconds: null },
      { text: "Simmer for 20-25 minutes until thick.", timerSeconds: 23 * 60 },
      { text: "Rest 1 hour.", timerSeconds: 3600 },
    ]);
  });
});
