import { describe, expect, it } from "vitest";

import { isOptimistic, withAdded } from "./pantry-preview";

const salt = { id: "1", name: "Salt", isStaple: false };
const rice = { id: "2", name: "Rice", isStaple: true };

describe("withAdded", () => {
  it("shows new names at once, marked as not saved yet", () => {
    const next = withAdded([salt], ["Eggs"], false);
    expect(next.map((i) => i.name)).toEqual(["Salt", "Eggs"]);
    expect(isOptimistic(next[1]!)).toBe(true);
    expect(isOptimistic(next[0]!)).toBe(false);
  });

  it("never duplicates what's already there, whatever the case or accents", () => {
    expect(withAdded([salt], ["salt", "SALT"], false)).toEqual([salt]);
    expect(withAdded([{ id: "3", name: "Crème", isStaple: false }], ["creme"], false)).toHaveLength(1);
    expect(withAdded([], ["Eggs", "eggs"], false)).toHaveLength(1);
  });

  it("adding as a staple promotes an existing item, and nothing is ever demoted", () => {
    expect(withAdded([salt], ["salt"], true)).toEqual([{ ...salt, isStaple: true }]);
    expect(withAdded([rice], ["rice"], false)).toEqual([rice]);
  });

  it("leaves the input untouched", () => {
    const items = [salt];
    withAdded(items, ["salt", "Oil"], true);
    expect(items).toEqual([salt]);
  });
});
