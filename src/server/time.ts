import "server-only";

import { cookies, headers } from "next/headers";

import { IP_TIME_ZONE_HEADER, pickTimeZone, TIME_ZONE_COOKIE } from "@/i18n/time-zone";
import { dayIn, minutesIn } from "@/lib/dates";

/** The viewer's zone: the browser's, else their IP address's (see pickTimeZone), else UTC. */
export async function requestTimeZone(): Promise<string> {
  const [jar, list] = await Promise.all([cookies(), headers()]);
  return pickTimeZone(jar.get(TIME_ZONE_COOKIE)?.value, list.get(IP_TIME_ZONE_HEADER));
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
