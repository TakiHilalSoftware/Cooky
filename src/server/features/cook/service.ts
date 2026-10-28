import "server-only";

import { daysBetween } from "@/lib/dates";
import type { DietaryTag, Season } from "@/lib/dishes";
import { matches } from "@/server/features/ingredients/service";

// Cook's ranking (PRD §3.4, ARCHITECTURE §5.7). Pure: unit-tested.

/** One ingredient line of a dish: the name to match, the name to show, and its dictionary entry. */
export type RankLine = { name: string; displayName: string; ingredientId: string | null };

export type RankableDish = {
  id: string;
  seasons: Season[];
  dietaryTags: DietaryTag[];
  lines: RankLine[];
  /** The last day it was cooked ("YYYY-MM-DD"), if ever. */
  lastCooked: string | null;
};

/** Something the person has: every name it goes by, and its dictionary entry. */
export type HaveItem = { names: string[]; ingredientId: string | null };

export type RankContext = {
  have: HaveItem[];
  /** The seasons today's weather favours (or the calendar season). */
  favoured: readonly Season[];
  dietaryPrefs: readonly DietaryTag[];
  today: string;
  /**
   * The meal Cook suggests for: dishes planned for it come first, and dishes
   * the person has logged for it before ("usual", times per dish) rise.
   */
  meal?: { planned: ReadonlySet<string>; usual: ReadonlyMap<string, number> };
};

export type RankedDish = {
  id: string;
  /** Display names of what's missing, in recipe order. */
  missing: string[];
  /** 2: suits today's weather/season · 1: no seasons set · 0: a different season. */
  weatherFit: 0 | 1 | 2;
  dietFit: boolean;
  daysSinceCooked: number | null;
  /** On the planner for the meal Cook suggests for. */
  planned: boolean;
  /** How many times it was logged for that meal before. */
  usualCount: number;
};

/** Cooked within this many days: moved down, so the same dish doesn't top the list all week. */
const RECENT_DAYS = 3;
/** Never cooked counts like "a month ago": fresh ideas, but not ahead of long-forgotten favourites. */
const NEVER_COOKED_DAYS = 30;

/** A line is covered when the person has it: same dictionary entry, or the have-name's words all match the line. */
export function isHad(line: RankLine, have: HaveItem[]): boolean {
  return have.some((item) =>
    item.ingredientId && line.ingredientId
      ? item.ingredientId === line.ingredientId
      : item.names.some((name) => matches(line.name, name)),
  );
}

export function missingFor(lines: RankLine[], have: HaveItem[]): string[] {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const line of lines) {
    if (isHad(line, have)) continue;
    const key = line.displayName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    missing.push(line.displayName);
  }
  return missing;
}

function recencyScore(daysSince: number | null): number {
  if (daysSince === null) return NEVER_COOKED_DAYS;
  if (daysSince <= RECENT_DAYS) return -100 + daysSince;
  return Math.min(daysSince, 60);
}

/**
 * What's planned for the meal first (the person already chose it), then
 * fewest missing ingredients, how often it's had at that meal, weather fit,
 * dietary fit, and how long since it was last cooked (ARCHITECTURE §5.7).
 * Ties keep the input order.
 */
export function rankDishes(dishes: RankableDish[], context: RankContext): RankedDish[] {
  const ranked = dishes.map((dish, index) => {
    const daysSinceCooked = dish.lastCooked ? daysBetween(dish.lastCooked, context.today) : null;
    const weatherFit: 0 | 1 | 2 =
      dish.seasons.length === 0 ? 1 : dish.seasons.some((s) => context.favoured.includes(s)) ? 2 : 0;
    return {
      index,
      id: dish.id,
      missing: missingFor(dish.lines, context.have),
      weatherFit,
      dietFit: context.dietaryPrefs.every((pref) => dish.dietaryTags.includes(pref)),
      daysSinceCooked,
      planned: context.meal?.planned.has(dish.id) ?? false,
      usualCount: context.meal?.usual.get(dish.id) ?? 0,
    };
  });
  ranked.sort(
    (a, b) =>
      Number(b.planned) - Number(a.planned) ||
      a.missing.length - b.missing.length ||
      b.usualCount - a.usualCount ||
      b.weatherFit - a.weatherFit ||
      Number(b.dietFit) - Number(a.dietFit) ||
      recencyScore(b.daysSinceCooked) - recencyScore(a.daysSinceCooked) ||
      a.index - b.index,
  );
  return ranked.map(({ index: _index, ...rest }) => rest);
}

/** "Almost": missing at most this many ingredients, one shopping trip (or one "I have it") away. */
export const ALMOST_MAX_MISSING = 2;

/**
 * My kitchen's "Ready to cook" panel: ranked dishes split into what can be
 * made now and what's nearly there, each capped at `shown`. Counts are over
 * every dish, so "and 4 more" stays honest when the lists are cut.
 */
export function splitReady<T extends Pick<RankedDish, "missing">>(ranked: T[], shown: number) {
  const ready = ranked.filter((d) => d.missing.length === 0);
  const almost = ranked.filter((d) => d.missing.length > 0 && d.missing.length <= ALMOST_MAX_MISSING);
  return {
    ready: ready.slice(0, shown),
    almost: almost.slice(0, shown),
    readyCount: ready.length,
    almostCount: almost.length,
  };
}
