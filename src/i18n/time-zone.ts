/** Cookie holding the browser's IANA time zone (a UI convenience, AGENT_RULES §2). */
export const TIME_ZONE_COOKIE = "cooky.tz";

/** The zone if the runtime knows it, else null. */
export function validTimeZone(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return candidate;
  } catch {
    return null;
  }
}

/** The zone if the runtime knows it, else UTC. */
export function resolveTimeZone(candidate: string | null | undefined): string {
  return validTimeZone(candidate) ?? "UTC";
}

/** The IANA zone of the request's IP address, added by Vercel's edge to every request. */
export const IP_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

/**
 * The person's zone for a request: the browser's own (the cookie it sets
 * after the first page), else the one their IP address is in, so even the
 * very first page shows their local day and time; UTC only without either.
 */
export function pickTimeZone(cookie: string | null | undefined, ipZone: string | null | undefined): string {
  return validTimeZone(cookie) ?? resolveTimeZone(ipZone);
}
