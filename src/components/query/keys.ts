import type { AppLocale } from "@/i18n/routing";

/**
 * Every query key in one place, so a mutation can name exactly what it
 * changes. The cache belongs to one signed-in account (see QueryProvider), so
 * keys never need a user id.
 */
export const queryKeys = {
  kitchen: {
    all: ["kitchen"] as const,
    pantry: (locale: AppLocale) => ["kitchen", "pantry", locale] as const,
    ready: (locale: AppLocale) => ["kitchen", "ready", locale] as const,
  },
  search: (locale: AppLocale, q: string) => ["search", locale, q] as const,
  ingredients: (locale: AppLocale, q: string) => ["ingredients", locale, q] as const,
};

/** Mutation keys, so `isMutating` can tell whether other writes to the same data are still in flight. */
export const mutationKeys = {
  kitchen: ["kitchen"] as const,
};
