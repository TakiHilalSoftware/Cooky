import "server-only";

import { cache } from "react";

import type { Season } from "@/lib/dishes";
import { getSession } from "@/server/auth/session";
import { loadProfile } from "@/server/features/profile/queries";
import { logger } from "@/server/observability/logger";

import { cachedReading, weatherKey } from "./cache";
import { fetchCurrent } from "./client";
import type { WeatherChipDto, WeatherDto } from "./dto";
import { accentFor, conditionFor, moodFor, seasonFor, type Mood } from "./service";

/** Everything ranking needs from the weather, for one person. */
export type WeatherContext = { weather: WeatherDto | null; mood: Mood; season: Season };

async function weatherAt(latitude: number, longitude: number): Promise<WeatherDto | null> {
  try {
    const reading = await cachedReading(weatherKey(latitude, longitude), () => fetchCurrent(latitude, longitude));
    return {
      condition: conditionFor(reading),
      accent: accentFor(reading.tempC),
      tempC: Math.round(reading.tempC),
      feelsLikeC: Math.round(reading.feelsLikeC),
      windKmh: Math.round(reading.windKmh),
      precipMm: Math.round(reading.precipMm * 10) / 10,
      isDay: reading.isDay,
      mood: moodFor(reading),
    };
  } catch (err) {
    // ARCHITECTURE §5.5: on failure the chip hides and the mood is neutral.
    logger.warn({ err: err instanceof Error ? err.message : "unknown" }, "weather unavailable");
    return null;
  }
}

/**
 * The one weather result for this person and request: the chip, Cook, Spin
 * and the Assistant all read it, so they always agree (PRD §3.4).
 */
export const loadWeatherContext = cache(async (userId: string, now: Date = new Date()): Promise<WeatherContext> => {
  const profile = await loadProfile(userId);
  const latitude = profile?.latitude ?? null;
  const longitude = profile?.longitude ?? null;
  const weather = latitude !== null && longitude !== null ? await weatherAt(latitude, longitude) : null;
  return { weather, mood: weather?.mood ?? "neutral", season: seasonFor(now, latitude) };
});

export const getWeatherChip = cache(async (): Promise<WeatherChipDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const profile = await loadProfile(session.user.id);
  if (profile?.latitude == null || profile.longitude == null) {
    return profile?.city ? { status: "not_found", city: profile.city } : { status: "no_location" };
  }
  const { weather, season } = await loadWeatherContext(session.user.id);
  return weather ? { status: "ok", weather, season } : null;
});
