import "server-only";

import type { Season } from "@/lib/dishes";

// How it feels outside, from Open-Meteo's numbers (ARCHITECTURE §5.5). Pure: unit-tested.
// The chip, Cook, Spin and the Assistant all read this one result, so they always agree.

export type Condition = "sunny" | "clear_night" | "cloudy" | "rainy" | "stormy" | "snowy" | "foggy" | "windy";
export type Accent = "hot" | "freezing";
export type Mood = "cozy" | "light" | "neutral";

export type Reading = {
  tempC: number;
  feelsLikeC: number;
  windKmh: number;
  precipMm: number;
  weatherCode: number;
  isDay: boolean;
};

/** WMO weather code → condition. Wind ≥ 40 km/h turns a clear or cloudy sky into "windy". */
export function conditionFor({ weatherCode: code, isDay, windKmh }: Reading): Condition {
  let condition: Condition;
  if (code >= 95) condition = "stormy";
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) condition = "snowy";
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) condition = "rainy";
  else if (code === 45 || code === 48) condition = "foggy";
  else if (code === 2 || code === 3) condition = "cloudy";
  else condition = isDay ? "sunny" : "clear_night";
  const calm = condition === "sunny" || condition === "clear_night" || condition === "cloudy";
  return calm && windKmh >= 40 ? "windy" : condition;
}

export function accentFor(tempC: number): Accent | null {
  if (tempC >= 30) return "hot";
  if (tempC <= 0) return "freezing";
  return null;
}

/**
 * PRD §3.4: rainy, stormy, snowy, freezing or under 15 °C → cozy; over 24 °C
 * and dry → light; otherwise neutral (the calendar season decides).
 */
export function moodFor(reading: Reading): Mood {
  const condition = conditionFor(reading);
  if (condition === "rainy" || condition === "stormy" || condition === "snowy" || reading.tempC < 15) return "cozy";
  if (reading.tempC > 24 && reading.precipMm === 0) return "light";
  return "neutral";
}

const NORTH: Season[] = [
  "winter",
  "winter",
  "spring",
  "spring",
  "spring",
  "summer",
  "summer",
  "summer",
  "autumn",
  "autumn",
  "autumn",
  "winter",
];
const OPPOSITE: Record<Season, Season> = { winter: "summer", spring: "autumn", summer: "winter", autumn: "spring" };

/** Meteorological seasons, flipped south of the equator. Without a location, the north is assumed. */
export function seasonFor(date: Date, latitude: number | null): Season {
  const north = NORTH[date.getUTCMonth()]!;
  return latitude !== null && latitude < 0 ? OPPOSITE[north] : north;
}

/** The seasons a mood favours in ranking: cozy → autumn/winter, light → spring/summer, neutral → today's season. */
export function favouredSeasons(mood: Mood, season: Season): Season[] {
  if (mood === "cozy") return ["autumn", "winter"];
  if (mood === "light") return ["spring", "summer"];
  return [season];
}
