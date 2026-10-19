import "server-only";

import { z } from "zod";

import { env } from "@/server/env";

import type { Reading } from "./service";

const TIMEOUT_MS = 3_000;

/**
 * The commercial API with a key; without one, the free endpoint, and only in
 * development (it's non-commercial). Deployed builds without a key get null.
 */
function endpoint(kind: "forecast" | "geocoding"): { base: string; key: string | null } | null {
  const key = env.OPEN_METEO_API_KEY ?? null;
  if (key) {
    return kind === "forecast"
      ? { base: "https://customer-api.open-meteo.com/v1/forecast", key }
      : { base: "https://customer-geocoding-api.open-meteo.com/v1/search", key };
  }
  if (env.NODE_ENV === "production") return null;
  return kind === "forecast"
    ? { base: "https://api.open-meteo.com/v1/forecast", key: null }
    : { base: "https://geocoding-api.open-meteo.com/v1/search", key: null };
}

async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`open-meteo ${response.status}`);
  return response.json();
}

const currentSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    precipitation: z.number(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number(),
    is_day: z.union([z.literal(0), z.literal(1)]),
  }),
});

/** Current conditions at a rough position. Throws on any failure; the caller degrades. */
export async function fetchCurrent(latitude: number, longitude: number): Promise<Reading> {
  const api = endpoint("forecast");
  if (!api) throw new Error("open-meteo not configured");
  const url = new URL(api.base);
  url.searchParams.set("latitude", latitude.toFixed(2));
  url.searchParams.set("longitude", longitude.toFixed(2));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  if (api.key) url.searchParams.set("apikey", api.key);
  const { current } = currentSchema.parse(await getJson(url));
  return {
    tempC: current.temperature_2m,
    feelsLikeC: current.apparent_temperature,
    precipMm: current.precipitation,
    weatherCode: current.weather_code,
    windKmh: current.wind_speed_10m,
    isDay: current.is_day === 1,
  };
}

const geocodeSchema = z.object({
  results: z.array(z.object({ latitude: z.number(), longitude: z.number() })).optional(),
});

/** A city name → rough coordinates, or null when it isn't found (or the lookup fails). */
export async function geocodeCity(
  name: string,
  language: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const api = endpoint("geocoding");
  if (!api) return null;
  const url = new URL(api.base);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");
  if (api.key) url.searchParams.set("apikey", api.key);
  try {
    const first = geocodeSchema.parse(await getJson(url)).results?.[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch {
    return null;
  }
}
