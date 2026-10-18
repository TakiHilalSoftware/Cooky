import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { routing } from "./routing";
import { resolveTimeZone, TIME_ZONE_COOKIE } from "./time-zone";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // One clock and one zone for the server render and the browser, so dates
    // and "5 minutes ago" render identically on both (no hydration mismatch).
    now: new Date(),
    timeZone: resolveTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value),
  };
});
