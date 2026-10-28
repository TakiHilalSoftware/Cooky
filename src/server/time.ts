import "server-only";

import { cookies } from "next/headers";

import { resolveTimeZone, TIME_ZONE_COOKIE } from "@/i18n/time-zone";
import { dayIn, minutesIn } from "@/lib/dates";

/** The viewer's zone from the cookie the browser sets (UTC until it has). */
export async function requestTimeZone(): Promise<string> {
  return resolveTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value);
}

/** "Today" for the person making this request, as "YYYY-MM-DD". */
export async function requestToday(now: Date = new Date()): Promise<string> {
  return dayIn(await requestTimeZone(), now);
}

/** The person's local day and time of day, from one reading of the clock. */
export async function requestClock(now: Date = new Date()): Promise<{ today: string; minutes: number }> {
  const zone = await requestTimeZone();
  return { today: dayIn(zone, now), minutes: minutesIn(zone, now) };
}
