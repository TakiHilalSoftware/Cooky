import "server-only";

import { cookies } from "next/headers";

import { resolveTimeZone, TIME_ZONE_COOKIE } from "@/i18n/time-zone";
import { dayIn } from "@/lib/dates";

/** The viewer's zone from the cookie the browser sets (UTC until it has). */
export async function requestTimeZone(): Promise<string> {
  return resolveTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value);
}

/** "Today" for the person making this request, as "YYYY-MM-DD". */
export async function requestToday(now: Date = new Date()): Promise<string> {
  return dayIn(await requestTimeZone(), now);
}
