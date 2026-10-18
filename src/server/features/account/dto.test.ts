import { describe, expect, it } from "vitest";

import { initialsOf } from "./dto";

describe("initialsOf", () => {
  it.each([
    ["Amina Benali", "AB"],
    ["lina", "L"],
    ["  Karim   El Idrissi ", "KE"],
    ["ليلى حسن", "لح"],
    ["", "?"],
  ])("%j → %s", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
