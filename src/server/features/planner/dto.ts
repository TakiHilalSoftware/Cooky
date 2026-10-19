// What the UI may know about the planner and calendar. Types only: safe for the UI.
import type { Course, CookSource, MealSlot } from "@/lib/dishes";
import type { CollectionDto } from "@/server/features/collections/dto";

export type PlannedMealDto = {
  id: string;
  dishId: string;
  name: string;
  photoUrl: string | null;
  date: string;
  mealSlot: MealSlot | null;
};

/** A dish in the planner's library, to drag (or tap) onto a day. */
export type LibraryDishDto = { id: string; name: string; course: Course; collectionIds: string[] };

/** An event on the planner or calendar; it opens its own page. */
export type PlannerEventDto = { id: string; name: string; date: string; guests: number };

export type PlannerDto = {
  weekStart: string;
  days: string[];
  today: string;
  meals: PlannedMealDto[];
  events: PlannerEventDto[];
  library: LibraryDishDto[];
  collections: CollectionDto[];
  /** How many meals last week had, so "Copy last week" only shows when it would do something. */
  lastWeekCount: number;
};

export type CalendarEntryDto =
  | { kind: "planned"; id: string; dishId: string; name: string; date: string; mealSlot: MealSlot | null }
  | {
      kind: "cooked";
      id: string;
      dishId: string;
      name: string;
      date: string;
      mealSlot: MealSlot | null;
      source: CookSource;
    }
  | { kind: "event"; id: string; name: string; date: string; guests: number };

export type CalendarDto = {
  month: string;
  days: string[];
  today: string;
  entries: CalendarEntryDto[];
};
