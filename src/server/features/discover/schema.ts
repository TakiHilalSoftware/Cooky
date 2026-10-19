// Shared by Discover's pages (URL filters) and its save action.
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { CATALOG_COLLECTIONS, COURSES, DIETARY_TAGS } from "@/lib/dishes";

/** Discover's filters, from the URL. Anything unexpected is simply ignored. */
export const discoverFiltersSchema = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .catch(undefined),
  course: z.enum(COURSES).optional().catch(undefined),
  diet: z.enum(DIETARY_TAGS).optional().catch(undefined),
  collection: z.enum(CATALOG_COLLECTIONS).optional().catch(undefined),
  /** "Ingredients you have", comma-separated. */
  have: z.string().trim().max(200).optional().catch(undefined),
});

export type DiscoverFilters = z.infer<typeof discoverFiltersSchema>;

export const catalogSlugSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(100),
});

export const saveCatalogDishSchema = catalogSlugSchema.extend({ locale: z.enum(routing.locales) });
