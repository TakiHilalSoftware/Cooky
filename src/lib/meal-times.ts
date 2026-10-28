// When the person usually eats (PRD §3.4): shared by the server, which decides
// the next meal, and Settings, which edits the times.
import type { MealSlot } from "./dishes";

/** Minutes after midnight (0–1439) for each meal, or null for "I don't have this meal". */
export type MealTimes = Record<MealSlot, number | null>;

/** A typical day, until the person sets their own. */
export const DEFAULT_MEAL_TIMES: MealTimes = {
  breakfast: 8 * 60,
  lunch: 12 * 60 + 30,
  snack: 16 * 60 + 30,
  dinner: 19 * 60 + 30,
};

export const MINUTES_PER_DAY = 24 * 60;

/** The meals in the order of a day (MEAL_SLOTS is ordered for the planner, not the clock). */
export const DAY_ORDER: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

/** Minutes after midnight as "HH:MM", the value of an <input type="time">. */
export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "HH:MM" as minutes after midnight, or null when it isn't a time. */
export function fromClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
