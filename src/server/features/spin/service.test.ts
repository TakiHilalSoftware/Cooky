import { describe, expect, it } from "vitest";

import { pickWeighted, spinWeight } from "./service";

describe("spinWeight", () => {
  it("favours today's season without ruling anything out", () => {
    expect([spinWeight(2), spinWeight(1), spinWeight(0)]).toEqual([3, 2, 1]);
  });
});

describe("pickWeighted", () => {
  const items = [
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
  ];

  it("lands on each item in proportion to its weight", () => {
    expect(pickWeighted(items, () => 0)?.id).toBe("a");
    expect(pickWeighted(items, () => 0.24)?.id).toBe("a");
    expect(pickWeighted(items, () => 0.26)?.id).toBe("b");
    expect(pickWeighted(items, () => 0.999)?.id).toBe("b");
  });

  it("matches the weights over many spins", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[pickWeighted(items, random)!.id as "a" | "b"]++;
    expect(counts.b / counts.a).toBeGreaterThan(2.6);
    expect(counts.b / counts.a).toBeLessThan(3.4);
  });

  it("returns null with nothing to pick", () => {
    expect(pickWeighted([], () => 0.5)).toBeNull();
  });
});
