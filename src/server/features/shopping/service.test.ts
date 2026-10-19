import { describe, expect, it } from "vitest";

import { combine, familyOf, mergeIntoList, roundAmount, toBuy, type IncomingLine, type ListItem } from "./service";

const line = (overrides: Partial<IncomingLine>): IncomingLine => ({
  key: "i:onion",
  name: "Onion",
  ingredientId: "onion",
  amount: 1,
  unit: null,
  aisle: "produce",
  dishId: "dish-a",
  ...overrides,
});

describe("combine", () => {
  it("sums the same unit and converts within a family", () => {
    expect(combine({ amount: 2, unit: "piece" }, { amount: 3, unit: "piece" })).toEqual({ amount: 5, unit: "piece" });
    expect(combine({ amount: 600, unit: "g" }, { amount: 0.5, unit: "kg" })).toEqual({ amount: 1.1, unit: "kg" });
    expect(combine({ amount: 2, unit: "tbsp" }, { amount: 1, unit: "tsp" })).toEqual({ amount: 35, unit: "ml" });
    expect(combine({ amount: 750, unit: "ml" }, { amount: 1, unit: "cup" })).toEqual({ amount: 990, unit: "ml" });
    expect(combine({ amount: 800, unit: "ml" }, { amount: 1, unit: "cup" })).toEqual({ amount: 1.04, unit: "l" });
  });

  it("lets a real amount win over 'to taste'", () => {
    expect(combine({ amount: null, unit: null }, { amount: 2, unit: "tsp" })).toEqual({ amount: 2, unit: "tsp" });
    expect(combine({ amount: 1, unit: "pinch" }, { amount: null, unit: null })).toEqual({ amount: 1, unit: "pinch" });
  });
});

describe("familyOf / roundAmount", () => {
  it("groups units that convert", () => {
    expect([familyOf("g"), familyOf("lb"), familyOf("cup"), familyOf("clove"), familyOf(null)]).toEqual([
      "mass",
      "mass",
      "volume",
      "clove",
      "none",
    ]);
    expect([roundAmount(0.3333), roundAmount(12.345), roundAmount(350.4)]).toEqual([0.33, 12.3, 350]);
  });
});

describe("toBuy", () => {
  it("rounds counted things up and leaves measures alone", () => {
    expect(toBuy({ amount: 4.5, unit: "clove" })).toEqual({ amount: 5, unit: "clove" });
    expect(toBuy({ amount: 1.5, unit: null })).toEqual({ amount: 2, unit: null });
    expect(toBuy({ amount: 3, unit: "piece" })).toEqual({ amount: 3, unit: "piece" });
    expect(toBuy({ amount: 1.5, unit: "tsp" })).toEqual({ amount: 1.5, unit: "tsp" });
    expect(toBuy({ amount: 225, unit: "g" })).toEqual({ amount: 225, unit: "g" });
  });
});

describe("mergeIntoList", () => {
  it("makes one item of the same ingredient from several dishes", () => {
    const merged = mergeIntoList(
      [],
      [
        line({ amount: 2 }),
        line({ amount: 3, dishId: "dish-b" }),
        line({ key: "i:salt", name: "Salt", amount: null, aisle: "spices" }),
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ name: "Onion", amount: 5, sourceDishIds: ["dish-a", "dish-b"] });
  });

  it("keeps non-convertible units apart", () => {
    const merged = mergeIntoList(
      [],
      [line({ key: "i:garlic", unit: "clove", amount: 3 }), line({ key: "i:garlic", unit: "piece", amount: 1 })],
    );
    expect(merged.map((m) => [m.unitFamily, m.amount])).toEqual([
      ["clove", 3],
      ["piece", 1],
    ]);
  });

  it("adds to what's on the list and unticks an item that's needed again", () => {
    const existing: ListItem[] = [
      {
        key: "i:rice",
        unitFamily: "mass",
        name: "Rice",
        ingredientId: "rice",
        amount: 500,
        unit: "g",
        aisle: "grains_pasta",
        sourceDishIds: ["x"],
        checked: true,
      },
    ];
    const [rice] = mergeIntoList(existing, [line({ key: "i:rice", name: "Rice", amount: 1, unit: "kg", dishId: "y" })]);
    expect(rice).toMatchObject({ amount: 1.5, unit: "kg", checked: false, sourceDishIds: ["x", "y"] });
    expect(existing[0]!.amount).toBe(500); // the input isn't mutated
  });
});
