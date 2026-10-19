import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dishes, dishIngredients, ingredients } from "@/server/db/schema";

import type { IngredientSuggestionDto } from "./dto";
import { allNames, matches, normalize } from "./service";

type Locale = "en" | "fr" | "ar";

const nameIn = (row: { nameEn: string; nameFr: string; nameAr: string }, locale: Locale) =>
  locale === "fr" ? row.nameFr : locale === "ar" ? row.nameAr : row.nameEn;

/** Normalized name or variant → dictionary id. Small (a few hundred rows), so it's kept in memory for a while. */
let lookup: { at: number; byName: Map<string, string> } | undefined;
const LOOKUP_TTL_MS = 10 * 60 * 1000;

async function nameLookup(): Promise<Map<string, string>> {
  if (lookup && Date.now() - lookup.at < LOOKUP_TTL_MS) return lookup.byName;
  const rows = await getDb()
    .select({
      id: ingredients.id,
      nameEn: ingredients.nameEn,
      nameFr: ingredients.nameFr,
      nameAr: ingredients.nameAr,
      variants: ingredients.variants,
    })
    .from(ingredients);
  const byName = new Map<string, string>();
  for (const row of rows) for (const name of allNames(row)) byName.set(normalize(name), row.id);
  lookup = { at: Date.now(), byName };
  return byName;
}

/**
 * The dictionary entry each ingredient line is, when its name is one of the
 * entry's names or variants in any language ("Tomates" and "بندورة" are both
 * tomato). Lines that aren't in the dictionary stay unlinked (null).
 */
export async function resolveIngredientIds(names: string[]): Promise<(string | null)[]> {
  const byName = await nameLookup();
  return names.map((name) => byName.get(normalize(name)) ?? null);
}

/** An ingredient line as the matcher sees it: its names (any language) and dictionary entry, if linked. */
export type MatchableLine = { names: string[]; ingredientId: string | null };

/**
 * Matches lines against what's wanted, using the dictionary first: when a
 * wanted word is a known entry ("طحينة" is tahini), it matches lines linked
 * to exactly that entry, so prefix look-alikes ("طحين", flour) don't. Lines
 * the dictionary doesn't know fall back to the text rules.
 */
export async function dictionaryMatcher(wanted: string[]) {
  const ids = await resolveIngredientIds(wanted);
  const idOf = new Map(wanted.map((want, i) => [want, ids[i] ?? null]));
  return (line: MatchableLine, want: string) => {
    const wantedId = idOf.get(want) ?? null;
    if (wantedId && line.ingredientId) return line.ingredientId === wantedId;
    return line.names.some((name) => matches(name, want));
  };
}

/** For tests: forget the cached lookup after the dictionary changes. */
export function clearIngredientLookup() {
  lookup = undefined;
}

const SUGGESTIONS = 8;
/** Enough of someone's own ingredient names to search through, without loading a whole box. */
const OWN_NAMES_SCANNED = 500;

/**
 * Autocomplete for an ingredient name: dictionary entries first (names that
 * start with what was typed, then close spellings by trigram similarity),
 * shown in the person's language, then names the person used before that the
 * dictionary doesn't know.
 */
export async function suggestIngredients(
  userId: string,
  query: string,
  locale: Locale,
): Promise<IngredientSuggestionDto[]> {
  const typed = normalize(query);
  if (typed.length === 0) return [];
  const db = getDb();
  // Normalized text holds only letters, digits and spaces, so it's safe inside the pattern.
  const wordStart = `(^| )${typed}`;

  const dictionary = await db
    .select({
      id: ingredients.id,
      nameEn: ingredients.nameEn,
      nameFr: ingredients.nameFr,
      nameAr: ingredients.nameAr,
      defaultUnit: ingredients.defaultUnit,
    })
    .from(ingredients)
    .where(sql`${ingredients.search} ~ ${wordStart} or word_similarity(${typed}, ${ingredients.search}) > 0.5`)
    .orderBy(
      sql`(${ingredients.search} ~ ${wordStart}) desc`,
      sql`word_similarity(${typed}, ${ingredients.search}) desc`,
      sql`${ingredients.isCommonStaple} desc`,
    )
    .limit(SUGGESTIONS);

  const fromDictionary: IngredientSuggestionDto[] = dictionary.map((row) => ({
    name: nameIn(row, locale),
    defaultUnit: row.defaultUnit,
    source: "dictionary",
  }));

  const known = new Set(fromDictionary.map((s) => normalize(s.name)));
  const room = SUGGESTIONS - fromDictionary.length;
  if (room <= 0) return fromDictionary;

  // The person's own names that aren't dictionary entries ("Grandma's spice mix"),
  // matched with the same normalize() as everything else.
  const own = await db
    .selectDistinct({ name: dishIngredients.name, unit: dishIngredients.unit })
    .from(dishIngredients)
    .innerJoin(dishes, eq(dishes.id, dishIngredients.dishId))
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt), isNull(dishIngredients.ingredientId)))
    .limit(OWN_NAMES_SCANNED);

  const fromYou: IngredientSuggestionDto[] = [];
  for (const row of own) {
    const key = normalize(row.name);
    if (known.has(key) || !` ${key}`.includes(` ${typed}`)) continue;
    known.add(key);
    fromYou.push({ name: row.name, defaultUnit: row.unit, source: "yours" });
  }
  return [...fromDictionary, ...fromYou.slice(0, room)];
}
