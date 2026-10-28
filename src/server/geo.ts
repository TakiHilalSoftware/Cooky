import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { env, isOnVercel, isStrictEnv } from "@/server/env";

/**
 * Where a request comes from, by its IP address: Vercel's edge geolocates
 * every request and adds the result as headers, so there's no lookup and no
 * third party. It's approximate (a mobile network may place everyone in its
 * hub city, a VPN anywhere), so it only ever suggests or fills a gap for this
 * request: a city to confirm, and the weather until one is set. Nothing here
 * is stored or logged. (The time zone header is read in src/i18n/time-zone.ts.)
 */
export type RequestGeo = {
  city: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  /** Rounded to about 1 km, like a saved location. */
  latitude: number | null;
  longitude: number | null;
};

export const NO_GEO: RequestGeo = { city: null, country: null, latitude: null, longitude: null };

type Read = (name: string) => string | null | undefined;

function coordinate(value: string | null | undefined, limit: number): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? Math.round(n * 100) / 100 : null;
}

/** Non-ASCII city names arrive percent-encoded (RFC 3986): "S%C3%A9tif" is Sétif. */
function city(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const name = decodeURIComponent(value).trim();
    return name && name.length <= 80 ? name : null;
  } catch {
    return null;
  }
}

/** Vercel's `x-vercel-ip-*` headers as a location; anything malformed is left out. */
export function geoFromHeaders(read: Read): RequestGeo {
  const latitude = coordinate(read("x-vercel-ip-latitude"), 90);
  const longitude = coordinate(read("x-vercel-ip-longitude"), 180);
  const located = latitude !== null && longitude !== null;
  const country = read("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  return {
    city: city(read("x-vercel-ip-city")),
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    latitude: located ? latitude : null,
    longitude: located ? longitude : null,
  };
}

/** GEO_DEV_OVERRIDE ("City|lat|lon|CC") read as if Vercel had sent it. */
export function devOverride(spec: string): Read {
  const [name, latitude, longitude, country] = spec.split("|");
  const values: Record<string, string | undefined> = {
    "x-vercel-ip-city": name ? encodeURIComponent(name) : undefined,
    "x-vercel-ip-latitude": latitude,
    "x-vercel-ip-longitude": longitude,
    "x-vercel-ip-country": country,
  };
  return (header) => values[header];
}

/**
 * This request's approximate location. Only Vercel's own headers are trusted
 * (its edge overwrites them, so a visitor can't); elsewhere there's none,
 * except the development override.
 */
export const requestGeo = cache(async (): Promise<RequestGeo> => {
  if (isOnVercel()) {
    const list = await headers();
    return geoFromHeaders((name) => list.get(name));
  }
  return env.GEO_DEV_OVERRIDE && !isStrictEnv() ? geoFromHeaders(devOverride(env.GEO_DEV_OVERRIDE)) : NO_GEO;
});
