import { describe, expect, it } from "vitest";

import { dishAllowance, scaleAmount } from "./service";

describe("scaleAmount", () => {
  it("scales in proportion to servings", () => {
    expect(scaleAmount(500, 4, 6)).toBe(750);
    expect(scaleAmount(2, 4, 2)).toBe(1);
    expect(scaleAmount(1, 2, 3)).toBe(1.5);
  });

  it("rounds to what a cook can measure", () => {
    expect(scaleAmount(1, 3, 1)).toBe(0.33);
    expect(scaleAmount(25, 3, 2)).toBe(16.7);
    expect(scaleAmount(250, 3, 2)).toBe(167);
  });

  it("keeps 'to taste' as written", () => {
    expect(scaleAmount(null, 4, 8)).toBeNull();
  });

  it("is the identity at the recipe's own servings", () => {
    expect(scaleAmount(0.75, 4, 4)).toBe(0.75);
  });
});

describe("dishAllowance", () => {
  it("allows adding below the cap", () => {
    expect(dishAllowance(49, 50)).toEqual({ count: 49, limit: 50, canAdd: true, readOnly: false });
  });

  it("at the cap: no more dishes, but editing is fine", () => {
    expect(dishAllowance(50, 50)).toMatchObject({ canAdd: false, readOnly: false });
  });

  it("over the cap after a downgrade: read-only until back under it", () => {
    expect(dishAllowance(62, 50)).toMatchObject({ canAdd: false, readOnly: true });
  });

  it("unlimited never blocks", () => {
    expect(dishAllowance(5000, null)).toMatchObject({ canAdd: true, readOnly: false });
  });
});
