// What the UI may know about events. Types only: safe for the UI.
import type { Course } from "@/lib/dishes";
import type { AssistantPickDto } from "@/server/features/assistant/dto";
import type { UsageDto } from "@/server/features/billing/dto";

export type EventSummaryDto = { id: string; name: string; date: string; guests: number; courses: number };

export type EventsPageDto = {
  upcoming: EventSummaryDto[];
  past: EventSummaryDto[];
  /** Upcoming events against the plan's cap (`plan_limits.upcoming_events`). */
  allowance: { count: number; limit: number | null; canAdd: boolean };
  today: string;
};

export type EventCourseDto = {
  course: Course;
  dish: { id: string; name: string; photoUrl: string | null; servings: number } | null;
};

export type EventDto = {
  id: string;
  name: string;
  date: string;
  guests: number;
  courses: EventCourseDto[];
  /** AI Suggest is on this plan (Plus and Pro); otherwise Suggest is rule-based. */
  aiSuggest: boolean;
  assistantUsage: UsageDto | null;
  /** The person's dishes by course, to choose from. */
  choices: { id: string; name: string; course: Course }[];
};

/** One suggested dish for a course, with why (AI) or without (rules). */
export type CourseSuggestionDto = AssistantPickDto;
