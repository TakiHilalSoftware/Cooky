import "server-only";

import { addDays } from "@/lib/dates";
import type { MealSlot } from "@/lib/dishes";
import { DAY_ORDER, MINUTES_PER_DAY, type MealTimes } from "@/lib/meal-times";

// Which meal Cook suggests for (PRD §3.4). Pure: unit-tested.

/** A meal stays "now" this long after its time: people are still cooking or just sitting down. */
export const MEAL_GRACE_MINUTES = 45;

export type MealMoment = {
  slot: MealSlot;
  /** Its time, in minutes after midnight. */
  at: number;
  /** The person's local day it falls on ("YYYY-MM-DD"). */
  date: string;
  /** "now": its time came less than the grace ago · "later": later today · "tomorrow". */
  when: "now" | "later" | "tomorrow";
  /** Minutes until its time (0 once it's "now"). */
  inMinutes: number;
};

type Clock = { today: string; minutes: number };

/** The meals the person has, in the order of their day (by time; ties in the usual order). */
export function mealsOfDay(times: MealTimes): { slot: MealSlot; at: number }[] {
  return DAY_ORDER.flatMap((slot) => {
    const at = times[slot];
    return at === null ? [] : [{ slot, at }];
  }).sort((a, b) => a.at - b.at || DAY_ORDER.indexOf(a.slot) - DAY_ORDER.indexOf(b.slot));
}

/** This meal's next occurrence: today until its grace has passed, then tomorrow. Null if they skip it. */
export function mealMoment(slot: MealSlot, times: MealTimes, clock: Clock): MealMoment | null {
  const at = times[slot];
  if (at === null) return null;
  if (clock.minutes < at + MEAL_GRACE_MINUTES) {
    const now = clock.minutes >= at;
    return { slot, at, date: clock.today, when: now ? "now" : "later", inMinutes: now ? 0 : at - clock.minutes };
  }
  return {
    slot,
    at,
    date: addDays(clock.today, 1),
    when: "tomorrow",
    inMinutes: MINUTES_PER_DAY - clock.minutes + at,
  };
}

/** The meal to cook for next: the first one today that hasn't passed, else tomorrow's first. Null without meal times. */
export function nextMeal(times: MealTimes, clock: Clock): MealMoment | null {
  const meals = mealsOfDay(times);
  const upcoming = meals.find((meal) => clock.minutes < meal.at + MEAL_GRACE_MINUTES) ?? meals[0];
  return upcoming ? mealMoment(upcoming.slot, times, clock) : null;
}
