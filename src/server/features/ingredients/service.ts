import "server-only";

// The ingredient matching rules (PRD §3.2, ARCHITECTURE §5.6). One service,
// used by autocomplete, search, Cook, Spin, the Assistant and the shopping
// merge, so "potato" means the same thing everywhere. Pure: unit-tested.

const ARABIC_FORMS: Record<string, string> = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ة: "ه", ى: "ي" };
const ARABIC_ARTICLE = "ال";
/** Words shorter than this must match exactly, so "oil" never matches "boiled". */
const MIN_PREFIX = 3;

/**
 * Folds what shouldn't matter for matching: case, accents (é → e, ç → c),
 * Arabic diacritics, tatweel and letter forms (أ/إ/آ → ا, ة → ه, ى → ي),
 * the Arabic article "ال" on words longer than 3 letters, and punctuation.
 */
export function normalize(text: string): string {
  return words(text).join(" ");
}

/** The normalized words of a text. */
export function words(text: string): string[] {
  const folded = text
    .toLowerCase()
    .normalize("NFD")
    // Combining marks: Latin accents and Arabic harakat alike.
    .replace(/\p{M}/gu, "")
    .replace(/[أإآٱةى]/g, (c) => ARABIC_FORMS[c] ?? c)
    .replace(/ـ/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
  return folded
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.startsWith(ARABIC_ARTICLE) ? word.slice(ARABIC_ARTICLE.length) : word));
}

/** One wanted word against one word of the line: prefix either way ("potato" ↔ "potatoes"). */
function wordMatches(wanted: string, word: string): boolean {
  if (wanted.length < MIN_PREFIX || word.length < MIN_PREFIX) return wanted === word;
  return word.startsWith(wanted) || wanted.startsWith(word);
}

/**
 * Whether an ingredient line matches what's wanted: every wanted word must
 * match some word of the line ("chicken" matches "Chicken breast", but
 * "chicken breast" doesn't match "Chicken").
 */
export function matches(line: string, wanted: string): boolean {
  const wantedWords = words(wanted);
  if (wantedWords.length === 0) return false;
  const lineWords = words(line);
  return wantedWords.every((w) => lineWords.some((word) => wordMatches(w, word)));
}

export type IngredientFilter<T> = { mode: "all" | "any" | "none"; items: T[] };

/**
 * Items (dishes) whose ingredients cover the wanted list: all of them first;
 * if nothing has them all, any of them, and the mode says so ("No dish uses
 * all of these…"). Lines are plain names by default; pass `lineMatches` to
 * match richer lines (e.g. by dictionary id).
 */
export function filterByIngredients<T, L = string>(
  items: T[],
  linesOf: (item: T) => L[],
  wanted: string[],
  lineMatches: (line: L, want: string) => boolean = (line, want) => matches(String(line), want),
): IngredientFilter<T> {
  const wants = wanted.filter((w) => words(w).length > 0);
  if (wants.length === 0) return { mode: "all", items };
  const has = (item: T, want: string) => linesOf(item).some((line) => lineMatches(line, want));
  const all = items.filter((item) => wants.every((want) => has(item, want)));
  if (all.length > 0) return { mode: "all", items: all };
  const any = items.filter((item) => wants.some((want) => has(item, want)));
  return any.length > 0 ? { mode: "any", items: any } : { mode: "none", items: [] };
}

type DictionaryEntry = { nameEn: string; nameFr: string; nameAr: string; variants: string[] };

/** Every name a dictionary entry goes by, in all three languages. */
export const allNames = (entry: DictionaryEntry) => [entry.nameEn, entry.nameFr, entry.nameAr, ...entry.variants];

/**
 * Every name and variant, normalized, between " | " separators: one string
 * pg_trgm can index, where a word start is always preceded by a space.
 */
export function searchTextFor(entry: DictionaryEntry): string {
  return ` ${allNames(entry).map(normalize).filter(Boolean).join(" | ")} `;
}
