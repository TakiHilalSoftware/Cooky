// What the UI may know about the weather. Types only: safe for the UI.
// No coordinates and no provider URL (ARCHITECTURE §5.5).
import type { Season } from "@/lib/dishes";

export type WeatherCondition = "sunny" | "clear_night" | "cloudy" | "rainy" | "stormy" | "snowy" | "foggy" | "windy";

export type WeatherDto = {
  condition: WeatherCondition;
  /** On top of the condition: ≥ 30 °C or ≤ 0 °C. */
  accent: "hot" | "freezing" | null;
  tempC: number;
  feelsLikeC: number;
  windKmh: number;
  precipMm: number;
  isDay: boolean;
  /** What Cook and Spin put first: cozy, light, or the calendar season. */
  mood: "cozy" | "light" | "neutral";
};

/** The top-bar chip: the weather, or what's missing to show it. null = hidden (signed out or provider down). */
export type WeatherChipDto =
  /** `approximate`: near where the connection is (its city, when known), until they set a city. */
  | { status: "ok"; weather: WeatherDto; season: Season; approximate: { city: string | null } | null }
  | { status: "no_location" }
  | { status: "not_found"; city: string };
