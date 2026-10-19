// What the UI may know about Cook. Types only: safe for the UI.
import type { Course, Season } from "@/lib/dishes";
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
  weather: WeatherDto | null;
  season: Season;
};

export type CookLogDto = { id: string; dishId: string; date: string };
