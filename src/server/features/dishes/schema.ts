// Shared by Server Actions (authoritative) and the dish form (instant hints).
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { COURSES, DIETARY_TAGS, DIFFICULTIES, DISH_BOUNDS as B, SEASONS, UNITS } from "@/lib/dishes";

/** Empty inputs arrive as "" or null; both mean "not given". */
const optionalNumber = (max: number, message: string, integer = false) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    (integer ? z.number({ error: message }).int(message) : z.number({ error: message }))
      .min(0, message)
      .max(max, message)
      .nullable(),
  );

const optionalText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max, message).nullable(),
  );

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "ingredientNameRequired").max(B.ingredientNameMax, "ingredientNameTooLong"),
  amount: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.number({ error: "amountInvalid" }).positive("amountInvalid").max(B.amountMax, "amountInvalid").nullable(),
  ),
  unit: z.enum(UNITS).nullable(),
  note: optionalText(B.ingredientNoteMax, "ingredientNoteTooLong"),
});

export const stepSchema = z.object({
  text: z.string().trim().min(1, "stepTextRequired").max(B.stepTextMax, "stepTextTooLong"),
  timerMinutes: optionalNumber(B.timerMinutesMax, "timerInvalid", true),
  prepDayBefore: z.boolean(),
});

const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((list) => new Set(list).size === list.length, "duplicate");

export const dishInputSchema = z.object({
  name: z.string().trim().min(1, "dishNameRequired").max(B.nameMax, "dishNameTooLong"),
  difficulty: z.enum(DIFFICULTIES),
  course: z.enum(COURSES),
  servings: z
    .number({ error: "servingsRange" })
    .int("servingsRange")
    .min(B.servingsMin, "servingsRange")
    .max(B.servingsMax, "servingsRange"),
  seasons: uniqueList(z.enum(SEASONS)),
  dietaryTags: uniqueList(z.enum(DIETARY_TAGS)),
  ingredients: z.array(ingredientSchema).min(1, "ingredientsRequired").max(B.ingredientsMax, "tooManyIngredients"),
  steps: z.array(stepSchema).max(B.stepsMax, "tooManySteps"),
  caloriesKcal: optionalNumber(B.caloriesMax, "nutritionInvalid", true),
  proteinG: optionalNumber(B.macroMax, "nutritionInvalid"),
  carbsG: optionalNumber(B.macroMax, "nutritionInvalid"),
  fatG: optionalNumber(B.macroMax, "nutritionInvalid"),
});

export type DishInput = z.infer<typeof dishInputSchema>;

/** Where an imported dish came from, credited on its page. */
export const dishSourceSchema = z.object({
  url: z.url({ protocol: /^https?$/ }).max(2000),
  siteName: z.string().trim().min(1).max(80),
  imageUrl: z
    .url({ protocol: /^https?$/ })
    .max(2000)
    .nullish(),
});

export const createDishSchema = dishInputSchema.extend({ source: dishSourceSchema.optional() });
export const updateDishSchema = dishInputSchema.extend({ id: z.uuid() });

export const importFromUrlSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  locale: z.enum(routing.locales),
});
export const dishIdSchema = z.object({ id: z.uuid() });
export const favoriteSchema = z.object({ dishId: z.uuid(), favorite: z.boolean() });
export const dishNoteSchema = z.object({ dishId: z.uuid(), text: z.string().trim().max(B.noteMax, "noteTooLong") });

/** My Dishes filters, from the URL. Anything unexpected is simply ignored. */
export const dishListFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  course: z.enum(COURSES).optional().catch(undefined),
  favorites: z
    .literal("1")
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
  collection: z.uuid().optional().catch(undefined),
  /** Just deleted from its page: the box offers Undo for it. */
  deleted: z.uuid().optional().catch(undefined),
});

/** ?servings= on the dish page. */
export const servingsParamSchema = z.coerce
  .number()
  .int()
  .min(B.servingsMin)
  .max(B.servingsMax)
  .optional()
  .catch(undefined);
