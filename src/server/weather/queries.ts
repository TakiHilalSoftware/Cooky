import "server-only";

import { cache } from "react";

import type { Season } from "@/lib/dishes";
import { getSession } from "@/server/auth/session";
import { loadProfile } from "@/server/features/profile/queries";
import { requestGeo } from "@/server/geo";
import { logger } from "@/server/observability/logger";

import { cachedReading, weatherKey } from "./cache";
import { fetchCurrent } from "./client";
import type { WeatherChipDto, WeatherDto } from "./dto";
import { accentFor, conditionFor, moodFor, seasonFor, type Mood } from "./service";

/**
 * Everything ranking needs from the weather, for one person. `approximate`:
 * read at the request's location by IP because they haven't set a place (its
 * city, when known); null when it's their own place.
 */
export type WeatherContext = {
  weather: WeatherDto | null;
  mood: Mood;
  season: Season;
  approximate: { city: string | null } | null;
};

type Place = { latitude: number; longitude: number; approximate: WeatherContext["approximate"] };

/** Where the weather is for: the person's saved place, else (without a city of theirs) the request's, unsaved. */
async function placeFor(profile: Awaited<ReturnType<typeof loadProfile>>): Promise<Place | null> {
  if (profile?.latitude != null && profile.longitude != null) {
    return { latitude: profile.latitude, longitude: profile.longitude, approximate: null };
  }
  // A city we couldn't find on the map is still their choice: never swap in a guess.
  if (profile?.city) return null;
  const geo = await requestGeo();
  return geo.latitude !== null && geo.longitude !== null
    ? { latitude: geo.latitude, longitude: geo.longitude, approximate: { city: geo.city } }
    : null;
}

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
  const place = await placeFor(await loadProfile(userId));
  const weather = place ? await weatherAt(place.latitude, place.longitude) : null;
  return {
    weather,
    mood: weather?.mood ?? "neutral",
    season: seasonFor(now, place?.latitude ?? null),
    approximate: weather ? (place?.approximate ?? null) : null,
  };
});

export const getWeatherChip = cache(async (): Promise<WeatherChipDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const profile = await loadProfile(session.user.id);
  const located = profile?.latitude != null && profile.longitude != null;
  if (!located && profile?.city) return { status: "not_found", city: profile.city };
  const { weather, season, approximate } = await loadWeatherContext(session.user.id);
  if (weather) return { status: "ok", weather, season, approximate };
  // No place of theirs and none from the connection: ask for a city. A saved place with the provider down: hidden.
  return located ? null : { status: "no_location" };
});
