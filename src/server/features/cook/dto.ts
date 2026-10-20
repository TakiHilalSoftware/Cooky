// What the UI may know about Cook. Types only: safe for the UI.
import type { Course, Season } from "@/lib/dishes";
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
