// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { COURSES } from "@/lib/dishes";
import { daySchema } from "@/server/features/planner/schema";

export const EVENT_BOUNDS = { nameMax: 100, guestsMin: 1, guestsMax: 500 } as const;

export const eventFieldsSchema = z.object({
  name: z.string().trim().min(1, "eventNameRequired").max(EVENT_BOUNDS.nameMax, "eventNameTooLong"),
  date: daySchema,
  guests: z.coerce
    .number()
    .int("guestsRange")
    .min(EVENT_BOUNDS.guestsMin, "guestsRange")
    .max(EVENT_BOUNDS.guestsMax, "guestsRange"),
});
export const updateEventSchema = eventFieldsSchema.extend({ id: z.uuid() });
export const eventIdSchema = z.object({ id: z.uuid() });
export const setEventDishSchema = z.object({ eventId: z.uuid(), course: z.enum(COURSES), dishId: z.uuid().nullable() });
export const suggestCourseSchema = z.object({
  eventId: z.uuid(),
  course: z.enum(COURSES),
  /** Dishes already offered, so "Another" moves on. */
  exclude: z.array(z.uuid()).max(100).default([]),
  locale: z.enum(routing.locales),
});
