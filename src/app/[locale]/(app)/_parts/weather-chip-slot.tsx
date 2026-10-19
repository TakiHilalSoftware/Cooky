import { getWeatherChip } from "@/server/weather/queries";

import { WeatherChip } from "@/components/weather/weather-chip";

/** Streams in after the page (behind Suspense), so a slow weather lookup never holds the page back. */
export async function WeatherChipSlot() {
  const chip = await getWeatherChip();
  return chip ? <WeatherChip chip={chip} /> : null;
}
