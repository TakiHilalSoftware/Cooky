// What the UI may know about Cook. Types only: safe for the UI.
import type { Course, MealSlot, Season } from "@/lib/dishes";
import type { CollectionDto } from "@/server/features/collections/dto";
import type { WeatherDto } from "@/server/weather/dto";

export type CookCardDto = {
  id: string;
  name: string;
  course: Course;
  photoUrl: string | null;
  /** What's missing, in the viewer's language where the dictionary knows it. */
  missing: string[];
  /** Suits today's weather or season. */
  weatherFit: boolean;
  /** Matches every dietary preference (always true without preferences). */
  dietFit: boolean;
  daysSinceCooked: number | null;
  /** On the planner for the meal Cook suggests for. */
  planned: boolean;
  /** Times it was logged for that meal before. */
  usualCount: number;
};

/** The meal Cook suggests for, and the person's day around it (the day rail). */
export type CookMealDto = {
  slot: MealSlot;
  /** Its time, in minutes after midnight. */
  at: number;
  /** "now": its time just came · "later": later today · "tomorrow". */
  when: "now" | "later" | "tomorrow";
  /** Minutes until its time. */
  inMinutes: number;
  /** Chosen on the rail (?meal=) instead of being the next meal. */
  picked: boolean;
  /** The person's meals in the order of their day; `passed`: today's is over. */
  day: { slot: MealSlot; at: number; passed: boolean }[];
  /** The time now, in minutes after midnight. */
  now: number;
  /** Dishes planned for this meal, shown first. */
  plannedCount: number;
  /** Dishes they've had at this meal before, lifted in the ranking. */
  usualCount: number;
  /** The slot "Log it for today" records, when the meal is today's. */
  logAs: MealSlot | null;
};

/** A kitchen item on Cook's what-if bar; `active: false` = left out via ?without=. */
export type CookHaveDto = { id: string; name: string; isStaple: boolean; active: boolean };

export type CookDto = {
  dishes: CookCardDto[];
  /** All dishes in the box, to tell "empty box" from "nothing to show". */
  total: number;
  have: CookHaveDto[];
  /** Extra ingredients from ?with=. */
  extras: string[];
  /** The person's collections, to narrow Cook to one. */
  collections: CollectionDto[];
  /** The collection Cook is narrowed to (?collection=), when it's one of theirs. */
  collection: string | null;
  weather: WeatherDto | null;
  season: Season;
  /** Null when the person has switched every meal off. */
  meal: CookMealDto | null;
};

export type CookLogDto = { id: string; dishId: string; date: string };

/** A dish on My kitchen's "Ready to cook" panel. */
export type ReadyDishDto = {
  id: string;
  name: string;
  course: Course;
  photoUrl: string | null;
  /** Empty when everything is in the kitchen; otherwise the one or two things to get. */
  missing: string[];
};

export type ReadyToCookDto = {
  /** Makeable now with what's in the kitchen. */
  ready: ReadyDishDto[];
  /** One or two ingredients short. */
  almost: ReadyDishDto[];
  readyCount: number;
  almostCount: number;
  /** All dishes in the box, to tell "empty box" from "nothing ready". */
  total: number;
};
