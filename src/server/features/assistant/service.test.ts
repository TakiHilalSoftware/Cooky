import { describe, expect, it } from "vitest";

import { questionWords, threadTitle, toPicks, type AliasMap } from "./service";

const aliases: AliasMap = new Map([
  ["m1", { kind: "mine", dishId: "dish-1" }],
  ["m2", { kind: "mine", dishId: "dish-2" }],
  ["d1", { kind: "discover", slug: "harira" }],
  ["d2", { kind: "discover", slug: "tagine" }],
]);

describe("toPicks", () => {
  it("keeps only real candidates: invented ids are dropped", () => {
    expect(
      toPicks(
        [
          { id: "m1", why: "Ready now" },
          { id: "m99", why: "Made up" },
          { id: "Chicken tikka", why: "Not even an alias" },
          { id: " D1 ", why: "Warming" },
        ],
        aliases,
      ),
    ).toEqual([
      { kind: "mine", dishId: "dish-1", why: "Ready now" },
      { kind: "discover", slug: "harira", why: "Warming" },
    ]);
  });

  it("shows each dish once and at most three", () => {
    const picks = toPicks(
      ["m1", "m1", "m2", "d1", "d2"].map((id) => ({ id, why: "x" })),
      aliases,
    );
    expect(picks.map((p) => (p.kind === "mine" ? p.dishId : p.slug))).toEqual(["dish-1", "dish-2", "harira"]);
  });
});

describe("threadTitle", () => {
  it("keeps short questions and cuts long ones at a word", () => {
    expect(threadTitle("  Something  quick for tonight ")).toBe("Something quick for tonight");
    expect(threadTitle("What can I make with chicken, potatoes, lemons, olives and a bit of saffron tonight?")).toBe(
      "What can I make with chicken, potatoes, lemons, olives and…",
    );
  });
});

describe("questionWords", () => {
  it("splits in any script and drops short words", () => {
    expect(questionWords("Poulet et pommes de terre ?")).toEqual(["poulet", "pommes", "terre"]);
    expect(questionWords("ماذا أطبخ بالدجاج")).toEqual(["ماذا", "أطبخ", "بالدجاج"]);
  });
});
