// Shared by the admin actions (authoritative) and the admin forms (hints).
import { z } from "zod";

import { COMP_MONTHS, FEEDBACK_KINDS, FEEDBACK_MESSAGE_MAX, FEEDBACK_STATUSES } from "@/lib/admin";
import { CATALOG_COLLECTIONS, COURSES, DIETARY_TAGS, DIFFICULTIES, SEASONS, UNITS } from "@/lib/dishes";
import { personId } from "@/server/features/social/schema";

export const adminUserSchema = z.object({ userId: personId });
export const adminSuspendSchema = adminUserSchema.extend({ suspended: z.boolean() });
export const adminRoleSchema = adminUserSchema.extend({ admin: z.boolean() });
export const adminCompSchema = adminUserSchema.extend({
  /** null takes the comp away. */
  plan: z.enum(["plus", "pro"]).nullable(),
  months: z.literal(COMP_MONTHS),
});

/** One text in English (required) and, when written, French and Arabic. */
function texts(max: number, required: boolean) {
  const en = z.string().trim().max(max);
  return z.object({
    en: required ? en.min(1, "nameRequired") : en,
    fr: z.string().trim().max(max),
    ar: z.string().trim().max(max),
  });
}

export const catalogDishSchema = z.object({
  id: z.uuid().nullable(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(2)
    .max(60),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  course: z.enum(COURSES),
  difficulty: z.enum(DIFFICULTIES),
  servings: z.number().int().min(1).max(100),
  seasons: z.array(z.enum(SEASONS)).max(SEASONS.length),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(DIETARY_TAGS.length),
  collections: z.array(z.enum(CATALOG_COLLECTIONS)).max(CATALOG_COLLECTIONS.length),
  featured: z.boolean(),
  name: texts(120, true),
  description: texts(600, true),
  ingredients: z
    .array(
      z.object({
        amount: z.number().positive().max(100_000).nullable(),
        unit: z.enum(UNITS).nullable(),
        name: texts(80, true),
        note: texts(120, false),
      }),
    )
    .min(1, "ingredientsRequired")
    .max(60, "tooManyIngredients"),
  steps: z
    .array(z.object({ text: texts(2000, true), timerMinutes: z.number().int().min(1).max(1440).nullable() }))
    .max(40, "tooManySteps"),
});
export type CatalogDishInput = z.infer<typeof catalogDishSchema>;

export const idSchema = z.object({ id: z.uuid() });

export const resolveReportSchema = z.object({
  id: z.uuid(),
  status: z.enum(["resolved", "dismissed"]),
  /** What was done, for the record. */
  resolution: z.string().trim().max(500).optional(),
  /** A quick action taken together with resolving. */
  action: z.enum(["none", "remove_content", "suspend_user"]).default("none"),
});

export const feedbackStatusSchema = z.object({ id: z.uuid(), status: z.enum(FEEDBACK_STATUSES) });

/** Settings → Help & feedback. */
export const sendFeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1, "messageRequired").max(FEEDBACK_MESSAGE_MAX, "messageTooLong"),
});
