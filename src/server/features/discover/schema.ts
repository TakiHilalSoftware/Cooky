// Shared by Discover's pages (URL filters) and its save action.
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { CATALOG_COLLECTIONS, COURSES, DIETARY_TAGS, DISCOVER_SORTS } from "@/lib/dishes";

/** No one taps "Show more" this often; a hand-typed huge page can't make the server render the world. */
export const DISCOVER_MAX_PAGES = 40;

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
  /** Unset: the default order for the viewer (for you when signed in, popular otherwise). */
  sort: z.enum(DISCOVER_SORTS).optional().catch(undefined),
  /** How many pages are shown: "Show more" grows the list, so a refresh or Back keeps the place. */
  page: z.coerce.number().int().min(1).max(DISCOVER_MAX_PAGES).optional().catch(undefined),
});

export type DiscoverFilters = z.infer<typeof discoverFiltersSchema>;

export const catalogSlugSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(100),
});

/** "Load more" while scrolling: the page's filters, plus which page and language. */
export const discoverMoreSchema = discoverFiltersSchema.extend({
  page: z.number().int().min(2).max(DISCOVER_MAX_PAGES),
  locale: z.enum(routing.locales),
});

export const saveCatalogDishSchema = catalogSlugSchema.extend({ locale: z.enum(routing.locales) });
