import "server-only";

import { geocodeCity } from "@/server/weather/client";

type Located = { city: string | null; latitude: number | null; longitude: number | null };

const rough = (n: number) => Math.round(n * 100) / 100;

/**
 * A typed city becomes rough coordinates for the weather, looked up on the
 * server (the browser never calls the provider). Device coordinates win when
 * present. An unknown city is saved as typed; the chip then says it wasn't found.
 */
export async function withLocation<T extends Located>(input: T, language: string): Promise<T> {
  if ((input.latitude !== null && input.longitude !== null) || !input.city) return input;
  const found = await geocodeCity(input.city, language);
  return found ? { ...input, latitude: rough(found.latitude), longitude: rough(found.longitude) } : input;
}
