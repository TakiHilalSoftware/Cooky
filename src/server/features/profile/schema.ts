// Shared by Server Actions (authoritative) and forms (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { ACCENTS, TEXT_SIZES, THEMES } from "@/lib/appearance";
import { DIETARY_TAGS } from "@/lib/dishes";
import { MINUTES_PER_DAY } from "@/lib/meal-times";

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, "nameRequired").max(60, "nameTooLong"),
});

/** Any subset of the appearance choices; each change saves on its own. */
export const appearanceSchema = z
  .object({ accent: z.enum(ACCENTS), theme: z.enum(THEMES), textSize: z.enum(TEXT_SIZES) })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const localeSchema = z.object({ locale: z.enum(routing.locales) });

const coordinate = (limit: number) =>
  z
    .number()
    .min(-limit)
    .max(limit)
    // About 1 km: enough for the weather and seasons, never a home address.
    .transform((n) => Math.round(n * 100) / 100)
    .nullable();

const mealTime = z
  .number()
  .int()
  .min(0)
  .max(MINUTES_PER_DAY - 1)
  .nullable();

/** When the person usually eats: minutes after midnight per meal, null for a meal they skip. */
export const mealTimesSchema = z.object({ breakfast: mealTime, lunch: mealTime, snack: mealTime, dinner: mealTime });

/** Where the person cooks, what they eat and when (onboarding and Settings). Without meal times, they're kept. */
export const kitchenSchema = z.object({
  city: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(80, "cityTooLong").nullable(),
  ),
  latitude: coordinate(90),
  longitude: coordinate(180),
  dietaryPrefs: z.array(z.enum(DIETARY_TAGS)).refine((list) => new Set(list).size === list.length, "duplicate"),
  mealTimes: mealTimesSchema.optional(),
});

/** Finishing the starter pack: the kitchen, plus the Discover dishes picked as favorites. */
export const completeOnboardingSchema = kitchenSchema.extend({
  locale: z.enum(routing.locales),
  favorites: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        .max(100),
    )
    .max(12),
  /** Everyday staples picked in the starter pack, saved to My kitchen as "always have". */
  staples: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
});
