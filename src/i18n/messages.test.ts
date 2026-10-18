import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** ICU argument names ({name}, {count, plural, …}) a message expects. */
function icuArguments(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)].map((m) => m[1] ?? "").sort();
}

const catalogs = { en: flatten(en), fr: flatten(fr), ar: flatten(ar) };
const reference = catalogs.en;

describe("message catalogs", () => {
  it.each(["fr", "ar"] as const)("%s has exactly the same keys as en", (locale) => {
    const keys = [...catalogs[locale].keys()].sort();
    expect(keys).toEqual([...reference.keys()].sort());
  });

  it.each(Object.keys(catalogs) as (keyof typeof catalogs)[])("%s has no empty strings", (locale) => {
    const empty = [...catalogs[locale]].filter(([, value]) => value.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it.each(["fr", "ar"] as const)("%s uses the same ICU arguments as en for every message", (locale) => {
    const mismatches = [...reference].filter(
      ([key, value]) => icuArguments(value).join() !== icuArguments(catalogs[locale].get(key) ?? "").join(),
    );
    expect(mismatches.map(([key]) => key)).toEqual([]);
  });

  it("Arabic copy is actually translated, not left in English", () => {
    // Only the language names list and brand-bearing strings may contain Latin text.
    const untranslated = [...catalogs.ar].filter(
      ([key, value]) => !key.startsWith("language.names.") && value === reference.get(key) && value !== "Cooky",
    );
    expect(untranslated.map(([key]) => key)).toEqual([]);
  });

  it("names every language in its own script, identically in all catalogs", () => {
    for (const catalog of Object.values(catalogs)) {
      expect(catalog.get("language.names.en")).toBe("English");
      expect(catalog.get("language.names.fr")).toBe("Français");
      expect(catalog.get("language.names.ar")).toBe("العربية");
    }
  });
});

describe("icuArguments", () => {
  it("finds simple and plural arguments", () => {
    expect(icuArguments("Hi {name}, {count, plural, one {# try} other {# tries}} left")).toEqual(["count", "name"]);
  });
});
