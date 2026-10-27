import "server-only";

import type { DietaryTag, DiscoverSort, Season } from "@/lib/dishes";
import { isHad, type HaveItem, type RankLine } from "@/server/features/cook/service";
import type { Mood } from "@/server/weather/service";

import type { SuggestionReason } from "./dto";

// Discover's ordering and "Picked for you" (PRD §3.3). Pure: unit-tested.

/** One catalog dish, as ranking sees it. */
export type CatalogCandidate = {
  id: string;
  /** In the viewer's language (A–Z sorts by what they read). */
  name: string;
  country: string;
  seasons: Season[];
  dietaryTags: DietaryTag[];
  lines: RankLine[];
  featured: boolean;
  /** Has its name in the viewer's language: better for them than an English-only import. */
  translated: boolean;
  /** How many people keep a copy: the "popular" signal. */
  saves: number;
  /** The viewer already has a copy. */
  saved: boolean;
  createdAt: Date;
};

export type SuggestContext = {
  /** Everything in the kitchen, staples included: what makes a dish cookable. */
  have: HaveItem[];
  /** The kitchen without staples: what's worth naming in a reason ("uses chicken", never "uses salt"). */
  keyHave: HaveItem[];
  favoured: readonly Season[];
  mood: Mood;
  dietaryPrefs: readonly DietaryTag[];
  /** Countries of the dishes they saved, with how many. */
  likedCountries: ReadonlyMap<string, number>;
  /** Changes once a day per person: picks are stable on refresh, fresh tomorrow. */
  seed: string;
};

/**
 * A stable number in [0, 1) for this dish and seed (FNV-1a). It replaces
 * `random()`: the same person sees the same picks all day, so a refresh, or
 * the re-render after saving a dish, never reshuffles the cards under them.
 */
export function dailyJitter(id: string, seed: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${seed}:${id}`) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32;
}

// Weights: what they can cook now matters most, then taste (countries they
// saved), the weather, what other cooks keep, and a daily rotation so the
// top never goes stale.
const WEIGHT = {
  coverage: 4,
  weather: 1.5,
  noSeason: 0.5,
  country: 0.6,
  countryMax: 3,
  featured: 0.75,
  saves: 0.5,
  jitter: 1.5,
  /** Each pick already from a country costs the next one from there this much: variety on the rail. */
  sameCountry: 0.9,
} as const;

/** Name a reason only when it's real: at least this many non-staple ingredients from their kitchen. */
const HAVE_REASON_MIN = 2;
const HAVE_REASON_NAMES = 3;

type Scored = { id: string; country: string; score: number; dietFit: boolean; saved: boolean; reason: SuggestionReason | null };

function weatherFitOf(dish: CatalogCandidate, favoured: readonly Season[]): 0 | 1 | 2 {
  if (dish.seasons.length === 0) return 1;
  return dish.seasons.some((s) => favoured.includes(s)) ? 2 : 0;
}

/** Display names of the key ingredients they have, in recipe order, without repeats. */
function namedHave(lines: RankLine[], keyHave: HaveItem[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    if (!isHad(line, keyHave)) continue;
    if (!names.some((n) => n.toLowerCase() === line.displayName.toLowerCase())) names.push(line.displayName);
  }
  return names;
}

/**
 * What sets this dish apart for this person, or null. Only reasons that
 * differ from card to card: weather, season and diet apply to the whole
 * list, so the list's heading says them once (on every card they're noise).
 */
function reasonFor(dish: CatalogCandidate, context: SuggestContext, haveNames: string[]): SuggestionReason | null {
  if (haveNames.length >= HAVE_REASON_MIN) return { kind: "have", names: haveNames.slice(0, HAVE_REASON_NAMES) };
  if (context.likedCountries.has(dish.country)) return { kind: "country" };
  return null;
}

export function scoreCatalog(dishes: CatalogCandidate[], context: SuggestContext): Scored[] {
  return dishes.map((dish) => {
    const weatherFit = weatherFitOf(dish, context.favoured);
    const had = dish.lines.filter((line) => isHad(line, context.have)).length;
    const coverage = dish.lines.length > 0 && context.have.length > 0 ? had / dish.lines.length : 0;
    const liked = Math.min(context.likedCountries.get(dish.country) ?? 0, WEIGHT.countryMax);
    const score =
      coverage * WEIGHT.coverage +
      (weatherFit === 2 ? WEIGHT.weather : weatherFit === 1 ? WEIGHT.noSeason : 0) +
      liked * WEIGHT.country +
      (dish.featured ? WEIGHT.featured : 0) +
      Math.log1p(dish.saves) * WEIGHT.saves +
      dailyJitter(dish.id, context.seed) * WEIGHT.jitter;
    const dietFit = context.dietaryPrefs.every((pref) => dish.dietaryTags.includes(pref));
    return {
      id: dish.id,
      country: dish.country,
      score,
      dietFit,
      saved: dish.saved,
      reason: reasonFor(dish, context, namedHave(dish.lines, context.keyHave)),
    };
  });
}

/** Variety looks back this far: no country fills a screen, none is pushed to the end of the list. */
const VARIETY_WINDOW = 6;

/** Best first, but each dish pays for others from its country among the last few placed. */
function diversify(pool: Scored[], limit = pool.length): Scored[] {
  const left = [...pool];
  const placed: Scored[] = [];
  while (placed.length < limit && left.length > 0) {
    const recent = placed.slice(-VARIETY_WINDOW);
    let best = 0;
    let bestScore = -Infinity;
    left.forEach((d, i) => {
      const adjusted = d.score - recent.filter((p) => p.country === d.country).length * WEIGHT.sameCountry;
      if (adjusted > bestScore) [best, bestScore] = [i, adjusted];
    });
    placed.push(...left.splice(best, 1));
  }
  return placed;
}

export type Ranked = { id: string; reason: SuggestionReason | null };

const ranked = ({ id, reason }: Scored): Ranked => ({ id, reason });

/**
 * "Picked for you": dishes they don't have yet that fit their diet (never a
 * pork dish for someone who eats halal), best first, mixed across countries.
 */
export function pickForYou(dishes: CatalogCandidate[], context: SuggestContext, limit: number): Ranked[] {
  const pool = scoreCatalog(dishes, context).filter((d) => !d.saved && d.dietFit);
  return diversify(pool, limit).map(ranked);
}

/**
 * The whole list in a sort order, with a reason per dish for "for you".
 * "For you" keeps everything (a filter's count must stay honest) but puts
 * dishes they already saved, then ones outside their diet, last.
 */
export function sortCatalog(
  dishes: CatalogCandidate[],
  sort: DiscoverSort,
  locale: string,
  context: SuggestContext | null,
): Ranked[] {
  if (sort === "for_you" && context) {
    const scored = scoreCatalog(dishes, context);
    const byScore = (a: Scored, b: Scored) => b.score - a.score;
    return [
      ...diversify(scored.filter((d) => d.dietFit && !d.saved)),
      ...scored.filter((d) => d.dietFit && d.saved).sort(byScore),
      ...scored.filter((d) => !d.dietFit).sort(byScore),
    ].map(ranked);
  }
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const byName = (a: CatalogCandidate, b: CatalogCandidate) => collator.compare(a.name, b.name);
  const newestFirst = (a: CatalogCandidate, b: CatalogCandidate) => b.createdAt.getTime() - a.createdAt.getTime();
  const sorted = [...dishes];
  if (sort === "name") sorted.sort(byName);
  else if (sort === "newest") sorted.sort((a, b) => newestFirst(a, b) || byName(a, b));
  else
    sorted.sort(
      (a, b) =>
        b.saves - a.saves ||
        Number(b.featured) - Number(a.featured) ||
        Number(b.translated) - Number(a.translated) ||
        newestFirst(a, b) ||
        byName(a, b),
    );
  return sorted.map((d) => ({ id: d.id, reason: null }));
}
