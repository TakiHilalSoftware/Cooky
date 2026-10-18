import "server-only";

import { hasLocale } from "next-intl";

import { routing, type AppLocale } from "@/i18n/routing";

type HeaderSource = Pick<Headers, "get"> | null | undefined;

/** First hop of x-forwarded-for (set by Vercel), else x-real-ip. */
export function clientIp(source: Request | HeaderSource): string | null {
  const headers = source && "headers" in source ? source.headers : source;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip") || null;
}

/**
 * The language the visitor is using: next-intl's locale cookie first, then
 * the browser's Accept-Language, then English.
 */
export function requestLocale(headers: HeaderSource): AppLocale {
  const cookie = headers?.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
  if (hasLocale(routing.locales, cookie)) return cookie;
  const accepted = headers?.get("accept-language") ?? "";
  for (const part of accepted.split(",")) {
    const tag = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (hasLocale(routing.locales, tag)) return tag;
  }
  return routing.defaultLocale;
}
