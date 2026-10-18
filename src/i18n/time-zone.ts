/** Cookie holding the browser's IANA time zone (a UI convenience, AGENT_RULES §2). */
export const TIME_ZONE_COOKIE = "cooky.tz";

/** The zone if the runtime knows it, else UTC (also the first-visit fallback). */
export function resolveTimeZone(candidate: string | undefined): string {
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}
