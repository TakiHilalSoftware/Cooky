import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

const RTL_LOCALES: ReadonlySet<AppLocale> = new Set(["ar"]);

export function directionOf(locale: AppLocale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

/** The route's locale as an AppLocale (the default for anything unexpected). */
export function asAppLocale(value: string): AppLocale {
  return routing.locales.find((locale) => locale === value) ?? routing.defaultLocale;
}
