import { describe, expect, it } from "vitest";

import { parseIngredientLine, splitIngredientText } from "./ingredient-line";

describe("parseIngredientLine", () => {
  it.each([
    ["2 cups flour", { amount: 2, unit: "cup", name: "flour", note: null }],
    ["1/2 tsp salt", { amount: 0.5, unit: "tsp", name: "salt", note: null }],
    ["1 1/2 kg lamb shoulder", { amount: 1.5, unit: "kg", name: "lamb shoulder", note: null }],
    ["1½ onions", { amount: 1.5, unit: null, name: "onions", note: null }],
    ["500g chicken thighs", { amount: 500, unit: "g", name: "chicken thighs", note: null }],
    ["3 cloves garlic, minced", { amount: 3, unit: "clove", name: "garlic", note: "minced" }],
    ["2-3 tomatoes", { amount: 2, unit: null, name: "tomatoes", note: null }],
    ["1 can (400 g) chopped tomatoes", { amount: 1, unit: "can", name: "chopped tomatoes", note: "400 g" }],
    ["2 tablespoons olive oil", { amount: 2, unit: "tbsp", name: "olive oil", note: null }],
  ])("reads %j", (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected);
  });

  it("reads French lines and drops the de/d'", () => {
    expect(parseIngredientLine("500 g de poulet")).toEqual({ amount: 500, unit: "g", name: "poulet", note: null });
    expect(parseIngredientLine("2 c. à s. d'huile d'olive")).toEqual({
      amount: 2,
      unit: "tbsp",
      name: "huile d'olive",
      note: null,
    });
    expect(parseIngredientLine("0,5 l de lait")).toEqual({ amount: 0.5, unit: "l", name: "lait", note: null });
    expect(parseIngredientLine("3 gousses d’ail, écrasées")).toEqual({
      amount: 3,
      unit: "clove",
      name: "ail",
      note: "écrasées",
    });
  });

  it("reads Arabic lines, Arabic-Indic digits and dual forms", () => {
    expect(parseIngredientLine("٥٠٠ غرام دجاج")).toEqual({ amount: 500, unit: "g", name: "دجاج", note: null });
    expect(parseIngredientLine("ملعقتان كبيرتان زيت زيتون")).toEqual({
      amount: 2,
      unit: "tbsp",
      name: "زيت زيتون",
      note: null,
    });
    expect(parseIngredientLine("2 كوب أرز، مغسول")).toEqual({ amount: 2, unit: "cup", name: "أرز", note: "مغسول" });
  });

  it("'to taste' has no amount, in any language", () => {
    expect(parseIngredientLine("salt, to taste")).toEqual({ amount: null, unit: null, name: "salt", note: null });
    expect(parseIngredientLine("Sel au goût")).toEqual({ amount: null, unit: null, name: "Sel", note: null });
    expect(parseIngredientLine("ملح حسب الرغبة")).toEqual({ amount: null, unit: null, name: "ملح", note: null });
  });

  it("never mistakes the start of a word for a unit", () => {
    expect(parseIngredientLine("garlic")).toEqual({ amount: null, unit: null, name: "garlic", note: null });
    expect(parseIngredientLine("2 large eggs")).toEqual({ amount: 2, unit: null, name: "large eggs", note: null });
    expect(parseIngredientLine("1 lemon")).toEqual({ amount: 1, unit: null, name: "lemon", note: null });
  });
});

describe("lines from real recipe sites", () => {
  it("takes nested brackets out as one note", () => {
    expect(parseIngredientLine("1 lb beef (chopped (shank, chuck or cheek))")).toEqual({
      amount: 1,
      unit: "lb",
      name: "beef",
      note: "chopped shank, chuck or cheek",
    });
  });

  it("keeps a second measure after a slash as a note", () => {
    expect(parseIngredientLine("600 g / 1.2lb chicken thigh , cut into 3cm cubes (Note 1)")).toEqual({
      amount: 600,
      unit: "g",
      name: "chicken thigh",
      note: "1.2lb, cut into 3cm cubes, Note 1",
    });
  });
});

describe("splitIngredientText", () => {
  it("splits dictation into lines on commas and 'and', in three languages", () => {
    expect(splitIngredientText("2 potatoes, 500 g of chicken and salt")).toEqual([
      "2 potatoes",
      "500 g of chicken",
      "salt",
    ]);
    expect(splitIngredientText("2 pommes de terre et 500 g de poulet")).toEqual([
      "2 pommes de terre",
      "500 g de poulet",
    ]);
    expect(splitIngredientText("حبتان بطاطس و 500 غرام دجاج")).toEqual(["حبتان بطاطس", "500 غرام دجاج"]);
  });
});
