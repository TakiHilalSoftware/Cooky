import { describe, expect, it } from "vitest";

import { accentFor, conditionFor, favouredSeasons, moodFor, seasonFor, type Reading } from "./service";

const reading = (overrides: Partial<Reading> = {}): Reading => ({
  tempC: 18,
  feelsLikeC: 18,
  windKmh: 10,
  precipMm: 0,
  weatherCode: 0,
  isDay: true,
  ...overrides,
});

describe("conditionFor", () => {
  it.each([
    [0, true, "sunny"],
    [1, false, "clear_night"],
    [2, true, "cloudy"],
    [3, true, "cloudy"],
    [45, true, "foggy"],
    [48, true, "foggy"],
    [51, true, "rainy"],
    [67, true, "rainy"],
    [80, true, "rainy"],
    [82, true, "rainy"],
    [71, true, "snowy"],
    [77, true, "snowy"],
    [85, true, "snowy"],
    [95, true, "stormy"],
    [99, true, "stormy"],
  ] as const)("WMO %i (day %s) → %s", (weatherCode, isDay, expected) => {
    expect(conditionFor(reading({ weatherCode, isDay }))).toBe(expected);
  });

  it("strong wind turns a clear or cloudy sky windy, but not rain or snow", () => {
    expect(conditionFor(reading({ weatherCode: 0, windKmh: 40 }))).toBe("windy");
    expect(conditionFor(reading({ weatherCode: 3, windKmh: 55 }))).toBe("windy");
    expect(conditionFor(reading({ weatherCode: 0, windKmh: 39 }))).toBe("sunny");
    expect(conditionFor(reading({ weatherCode: 61, windKmh: 60 }))).toBe("rainy");
  });
});

describe("accentFor", () => {
  it("adds hot from 30 °C and freezing at 0 °C and below", () => {
    expect(accentFor(30)).toBe("hot");
    expect(accentFor(29.9)).toBeNull();
    expect(accentFor(0)).toBe("freezing");
    expect(accentFor(0.1)).toBeNull();
  });
});

describe("moodFor", () => {
  it("is cozy in rain, storms, snow, or under 15 °C", () => {
    expect(moodFor(reading({ weatherCode: 61, tempC: 20 }))).toBe("cozy");
    expect(moodFor(reading({ weatherCode: 95, tempC: 28 }))).toBe("cozy");
    expect(moodFor(reading({ weatherCode: 71, tempC: 1 }))).toBe("cozy");
    expect(moodFor(reading({ tempC: 14.9 }))).toBe("cozy");
  });

  it("is light above 24 °C when dry, neutral in between", () => {
    expect(moodFor(reading({ tempC: 26 }))).toBe("light");
    expect(moodFor(reading({ tempC: 26, precipMm: 0.2, weatherCode: 3 }))).toBe("neutral");
    expect(moodFor(reading({ tempC: 24 }))).toBe("neutral");
    expect(moodFor(reading({ tempC: 15 }))).toBe("neutral");
  });
});

describe("seasonFor", () => {
  it("follows the hemisphere", () => {
    const january = new Date("2027-01-15T12:00:00Z");
    const july = new Date("2027-07-15T12:00:00Z");
    expect(seasonFor(january, 33.6)).toBe("winter"); // Casablanca
    expect(seasonFor(january, -33.9)).toBe("summer"); // Sydney
    expect(seasonFor(july, -33.9)).toBe("winter");
    expect(seasonFor(new Date("2027-04-10T00:00:00Z"), -34.6)).toBe("autumn"); // Buenos Aires
    expect(seasonFor(july, null)).toBe("summer");
  });
});

describe("favouredSeasons", () => {
  it("maps the mood to seasons, or keeps today's", () => {
    expect(favouredSeasons("cozy", "summer")).toEqual(["autumn", "winter"]);
    expect(favouredSeasons("light", "winter")).toEqual(["spring", "summer"]);
    expect(favouredSeasons("neutral", "autumn")).toEqual(["autumn"]);
  });
});
