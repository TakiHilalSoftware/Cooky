import { http, HttpResponse } from "msw";

/**
 * A tiny Open-Meteo (the free endpoints, used outside production): current
 * conditions and city search. Tests set the answers and count the calls.
 */
export const fakeWeather = {
  current: {
    temperature_2m: 12.4,
    apparent_temperature: 10.1,
    precipitation: 0.6,
    weather_code: 61,
    wind_speed_10m: 18,
    is_day: 1,
  } as Record<string, number>,
  cities: { Casablanca: { latitude: 33.58831, longitude: -7.61138 } } as Record<
    string,
    { latitude: number; longitude: number }
  >,
  fail: false,
  forecastCalls: 0,
  geocodeCalls: [] as string[],
  reset() {
    this.current = {
      temperature_2m: 12.4,
      apparent_temperature: 10.1,
      precipitation: 0.6,
      weather_code: 61,
      wind_speed_10m: 18,
      is_day: 1,
    };
    this.fail = false;
    this.forecastCalls = 0;
    this.geocodeCalls = [];
  },
};

export const weatherHandlers = [
  http.get("https://api.open-meteo.com/v1/forecast", () => {
    fakeWeather.forecastCalls++;
    if (fakeWeather.fail) return new HttpResponse(null, { status: 502 });
    return HttpResponse.json({ current: fakeWeather.current });
  }),
  http.get("https://geocoding-api.open-meteo.com/v1/search", ({ request }) => {
    const name = new URL(request.url).searchParams.get("name") ?? "";
    fakeWeather.geocodeCalls.push(name);
    const found = fakeWeather.cities[name];
    return HttpResponse.json(found ? { results: [{ name, ...found }] } : {});
  }),
];
