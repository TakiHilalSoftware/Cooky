import "server-only";

import { parseIngredientLine, type ParsedIngredient } from "@/server/features/dishes/ingredient-line";

// Reads the recipe a page publishes for search engines (schema.org Recipe in
// JSON-LD), which almost every recipe site has. Pure: unit-tested.

export type ExtractedRecipe = {
  name: string;
  description: string | null;
  servings: number | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  siteName: string;
  /** The recipe's photo, copied into storage only when the dish is saved. */
  imageUrl: string | null;
};

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Plain text: no tags, entities decoded, spaces collapsed. */
const clean = (value: unknown): string =>
  typeof value === "string"
    ? decodeEntities(value.replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim()
    : "";

function isRecipe(node: Node): boolean {
  const type = node["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

/** Every node in a JSON-LD document: top-level arrays, @graph and nested values. */
function* walk(value: unknown, depth = 0): Generator<Node> {
  if (depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item, depth + 1);
  } else if (isNode(value)) {
    yield value;
    for (const child of Object.values(value)) if (typeof child === "object") yield* walk(child, depth + 1);
  }
}

/** "4", "4 servings", "Serves 6", ["4", "4 portions"] → 4. Clamped to the form's 1–100. */
function servingsFrom(value: unknown): number | null {
  const text = Array.isArray(value)
    ? value.map(String).join(" ")
    : typeof value === "number"
      ? String(value)
      : clean(value);
  const n = Number(text.match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 100) : null;
}

/** Instructions come as a string, a list of strings, HowToSteps or HowToSections of HowToSteps. */
function stepsFrom(value: unknown): string[] {
  if (typeof value === "string") {
    return clean(value)
      .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ؀-ۿ])|\n+/u)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return isNode(value) ? stepsFrom([value]) : [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [clean(item)];
      if (!isNode(item)) return [];
      if (item["itemListElement"]) return stepsFrom(item["itemListElement"]);
      return [clean(item["text"] ?? item["name"])];
    })
    .filter(Boolean);
}

/** `image` is a URL, an ImageObject, or a list of either; the first usable http(s) one wins. */
function imageFrom(value: unknown, base: URL): string | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const raw =
      typeof candidate === "string"
        ? candidate
        : isNode(candidate)
          ? (candidate["url"] ?? candidate["contentUrl"])
          : null;
    if (typeof raw !== "string") continue;
    try {
      const url = new URL(decodeEntities(raw.trim()), base);
      if ((url.protocol === "https:" || url.protocol === "http:") && url.href.length <= 2000) return url.href;
    } catch {
      // Not a URL: try the next one.
    }
  }
  return null;
}

export function siteNameFrom(html: string, url: URL): string {
  const og =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i)?.[1];
  return og ? clean(og) : url.hostname.replace(/^www\./, "");
}

/** The page's recipe, or null when it doesn't publish one. Limits match the dish form. */
export function extractRecipe(html: string, url: URL): ExtractedRecipe | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(body!.trim());
    } catch {
      continue; // One broken block shouldn't hide another that works.
    }
    for (const node of walk(data)) {
      if (!isRecipe(node)) continue;
      const name = clean(node["name"]).slice(0, 120);
      const lines = Array.isArray(node["recipeIngredient"]) ? node["recipeIngredient"] : (node["ingredients"] ?? []);
      const ingredients = (Array.isArray(lines) ? lines : [])
        .map(clean)
        .filter(Boolean)
        .slice(0, 100)
        .map((line) => {
          const parsed = parseIngredientLine(line);
          return { ...parsed, name: parsed.name.slice(0, 120), note: parsed.note?.slice(0, 120) ?? null };
        });
      if (!name || ingredients.length === 0) continue;
      return {
        name,
        description: clean(node["description"]) || null,
        servings: servingsFrom(node["recipeYield"]),
        ingredients,
        steps: stepsFrom(node["recipeInstructions"])
          .map((s) => s.slice(0, 2000))
          .slice(0, 60),
        siteName: siteNameFrom(html, url).slice(0, 80),
        imageUrl: imageFrom(node["image"], url),
      };
    }
  }
  return null;
}
