/**
 * Turning a TheMealDB recipe into a Discover catalog entry. Pure: unit-tested
 * in src/server/features/discover/mealdb-parse.test.ts.
 *
 * Dietary tags are a promise to someone who may be allergic or observant, so
 * only what an ingredient list can prove is claimed (see inferDietaryTags).
 */
import type { Course, DietaryTag, Season, Unit } from "../src/lib/dishes";

export type MealDbRecipe = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  [key: string]: string | null | undefined;
};

/** TheMealDB's areas (adjectives) to ISO 3166-1 alpha-2. Others are skipped. */
export const AREA_TO_COUNTRY: Record<string, string> = {
  Moroccan: "MA",
  Tunisian: "TN",
  Algerian: "DZ",
  Egyptian: "EG",
  Turkish: "TR",
  Greek: "GR",
  Italian: "IT",
  French: "FR",
  Spanish: "ES",
  Lebanese: "LB",
  Syrian: "SY",
  Palestinian: "PS",
  Jordanian: "JO",
  Saudi: "SA",
  Indian: "IN",
  Mexican: "MX",
  Japanese: "JP",
  Chinese: "CN",
  Thai: "TH",
  Vietnamese: "VN",
  Malaysian: "MY",
  Filipino: "PH",
  American: "US",
  British: "GB",
  Canadian: "CA",
  Portuguese: "PT",
  Polish: "PL",
  Irish: "IE",
  Dutch: "NL",
  German: "DE",
  Russian: "RU",
  Ukrainian: "UA",
  Croatian: "HR",
  Jamaican: "JM",
  Kenyan: "KE",
};

/** "Classic Tourtière" → "classic-tourtiere": accents folded, never dropped (the route accepts [a-z0-9-]). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Same dish, however it's written: compares names across sources. */
export const sameName = (a: string, b: string) => slugify(a) === slugify(b);

/** Whole words only: "egg" must not match "eggplant", nor "gin" match "ginger". */
function hasWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => new RegExp(`\\b${word}(e?s)?\\b`, "i").test(text));
}

const MEAT = [
  "beef", "pork", "lamb", "mutton", "chicken", "bacon", "turkey", "ham", "sausage", "chorizo", "salami",
  "pepperoni", "prosciutto", "pancetta", "veal", "duck", "goose", "venison", "rabbit", "goat", "meat",
  "mince", "steak", "liver", "kidney(?!\\s*beans?)", "oxtail", "lard", "suet", "gelatine?", "black pudding", "brisket",
] as const;
const SEAFOOD = [
  "fish", "salmon", "tuna", "prawn", "shrimp", "squid", "calamari", "cod", "haddock", "mackerel", "sardine",
  "anchov(y|ies)", "clam", "mussel", "crab", "lobster", "scallop", "oyster", "monkfish", "trout", "kipper",
  "worcestershire", "bonito", "dashi",
] as const;
const ANIMAL_PRODUCTS = [
  "cheese", "milk", "butter", "cream", "yog(h)?urt", "parmesan", "cheddar", "mozzarella", "feta", "ghee",
  "honey", "custard", "mascarpone", "ricotta", "paneer", "cr[eè]me", "egg", "yolk", "mayonnaise", "buttermilk",
] as const;
const ALCOHOL = [
  "wine", "beer", "ale", "stout", "brandy", "rum", "sherry", "vodka", "whisk(e)?y", "gin", "liqueur", "cider",
  "mirin", "sake", "port", "marsala", "kirsch", "cognac", "bourbon", "tequila", "vermouth", "champagne",
  "prosecco", "calvados", "amaretto", "cointreau", "grand marnier", "kahlua", "madeira",
] as const;

/**
 * Only what the ingredient list can prove. Halal is claimed only without
 * meat or alcohol: whether meat is halal depends on how it was slaughtered,
 * which no recipe says. Allergen-free tags (gluten, dairy, nut, egg) are
 * never inferred: hidden sources (stock cubes, soy sauce, pesto) make a
 * keyword guess dangerous for someone allergic.
 */
export function inferDietaryTags(ingredients: string[]): DietaryTag[] {
  const text = ingredients.join(" | ");
  const meat = hasWord(text, MEAT);
  const seafood = hasWord(text, SEAFOOD);
  const tags: DietaryTag[] = [];
  if (!meat && !seafood) {
    if (!hasWord(text, ANIMAL_PRODUCTS)) tags.push("vegan");
    tags.push("vegetarian");
  } else if (!meat) tags.push("pescatarian");
  if (!meat && !hasWord(text, ALCOHOL)) tags.push("halal");
  return tags;
}

/** TheMealDB category to a course. Breakfast is a meal, not a starter. */
export function courseFor(category: string | null): Course {
  const cat = (category ?? "").toLowerCase();
  if (cat === "dessert") return "dessert";
  if (cat === "starter") return "appetizer";
  if (cat === "side") return "side";
  return "main";
}

/** Soups and stews read as cold-weather food, salads as warm-weather; the rest suit any season. */
export function seasonsFor(name: string, category: string | null): Season[] {
  if (/\b(soup|stew|casserole|tagine|chowder|hotpot|broth)\b/i.test(`${name} ${category ?? ""}`)) {
    return ["autumn", "winter"];
  }
  if (/\bsalad\b/i.test(name)) return ["spring", "summer"];
  return [];
}

/** Background ingredients: true of nearly every dish, so never what describes one. */
const STAPLES = new Set([
  "salt", "pepper", "black pepper", "olive oil", "vegetable oil", "sunflower oil", "oil", "water", "sugar",
  "caster sugar", "butter", "onion", "onions", "garlic", "garlic clove", "flour", "plain flour", "egg", "eggs",
  "canola oil", "rapeseed oil",
]);

const NOUN: Record<string, string> = {
  dessert: "dessert",
  starter: "starter",
  side: "side dish",
  breakfast: "breakfast",
  pasta: "pasta dish",
  seafood: "seafood dish",
};

/** "A Tunisian vegetarian dish with chickpeas, harissa and cumin." Facts only, no "authentic". */
export function describe(area: string, category: string | null, ingredients: string[], tags: DietaryTag[]): string {
  const key = ingredients.map((i) => i.trim().toLowerCase()).filter((i) => i && !STAPLES.has(i));
  const unique = [...new Set(key)].slice(0, 3);
  const noun =
    NOUN[(category ?? "").toLowerCase()] ??
    (tags.includes("vegan") ? "vegan dish" : tags.includes("vegetarian") ? "vegetarian dish" : "dish");
  const phrase = `${area} ${noun}`;
  const article = /^[aeiou]/i.test(phrase) ? "An" : "A";
  const list =
    unique.length <= 1 ? (unique[0] ?? "") : `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
  return list ? `${article} ${phrase} with ${list}.` : `${article} ${phrase}.`;
}

/** Unit words right after the amount ("2 tbsp", "500g"), most specific first ("kg" before "g"). */
const UNIT_WORDS: [RegExp, Unit][] = [
  [/^(tablespoons?|tblsp|tbsp|tbs)\b\.?/, "tbsp"],
  [/^(teaspoons?|tsp)\b\.?/, "tsp"],
  [/^cups?\b/, "cup"],
  [/^(kilograms?|kg)\b/, "kg"],
  [/^(millilit(er|re)s?|ml)\b/, "ml"],
  [/^(grams?|g)\b/, "g"],
  [/^(lit(er|re)s?|l)\b/, "l"],
  [/^cloves?\b/, "clove"],
  [/^pinch(es)?\b/, "pinch"],
  [/^bunch(es)?\b/, "bunch"],
  [/^slices?\b/, "slice"],
  [/^(cans?|tins?)\b/, "can"],
  [/^(oz|ounces?)\b/, "oz"],
  [/^(lbs?|pounds?)\b/, "lb"],
];

/** "1 1/2 tbsp chopped" → 1.5 tbsp, note "chopped". Whatever can't be structured stays in the note. */
export function parseMeasure(raw?: string | null): { amount: number | null; unit: Unit | null; note: string | null } {
  const str = raw?.trim().toLowerCase() ?? "";
  if (!str) return { amount: null, unit: null, note: null };
  const fraction = str.match(/^(\d+\s+)?(\d+)\/(\d+)/);
  const number = str.match(/^\d+(\.\d+)?/);
  const amount = fraction
    ? Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3])
    : number
      ? Number(number[0])
      : null;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return { amount: null, unit: null, note: str };
  let rest = str.slice((fraction ?? number)![0].length).trim();
  const found = UNIT_WORDS.find(([pattern]) => pattern.test(rest));
  if (found) rest = rest.replace(found[0], "").trim();
  return { amount: Math.round(amount * 100) / 100, unit: found?.[1] ?? null, note: rest || null };
}

/** Instructions to steps, with a timer when a step names a duration ("simmer 20-25 minutes" → 23 min). */
export function parseSteps(raw?: string | null): { text: string; timerSeconds: number | null }[] {
  if (!raw || !raw.trim()) return [];
  let parts = raw
    .split(/\r?\n\s*\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 1) {
    parts = raw
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return parts
    .filter((p) => !/^(step\s*\d+|instructions?|method)\s*:?$/i.test(p))
    .map((p) => p.replace(/^(step\s*\d+\s*[:.)-]?|\d+[.)]|[*•-])\s*/i, "").trim())
    .filter((p) => p.length > 5)
    .map((text) => {
      const match = text.match(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(minutes?|mins?|hours?|hrs?)\b/i);
      if (!match) return { text, timerSeconds: null };
      const low = Number(match[1]);
      const high = match[2] ? Number(match[2]) : low;
      const minutes = Math.round((low + high) / 2) * (/^h/i.test(match[3]!) ? 60 : 1);
      return { text, timerSeconds: minutes > 0 && minutes <= 240 ? minutes * 60 : null };
    });
}

/** The ingredient lines of a recipe, in order. */
export function ingredientLines(meal: MealDbRecipe) {
  const lines: { name: string; amount: number | null; unit: Unit | null; note: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    if (name) lines.push({ name, ...parseMeasure(meal[`strMeasure${i}`]) });
  }
  return lines;
}
