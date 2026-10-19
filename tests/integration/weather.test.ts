import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { resetData } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";
import { fakeWeather, weatherHandlers } from "./support/weather";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const settings = await import("@/server/actions/settings");
const { getWeatherChip } = await import("@/server/weather/queries");
const { getKitchen } = await import("@/server/features/profile/queries");
const { clearMemoryCache } = await import("@/server/weather/cache");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeWeather.reset();
  clearMemoryCache();
  hibp.use(...weatherHandlers);
  await signUpAndVerify();
  await logIn();
});

const KITCHEN = { city: null, latitude: null, longitude: null, dietaryPrefs: [] };

describe("saving where you cook", () => {
  it("looks a typed city up on the server and keeps rough coordinates", async () => {
    const { data } = await settings.updateKitchen({ ...KITCHEN, city: "Casablanca" });
    expect(data).toMatchObject({ city: "Casablanca", latitude: 33.59, longitude: -7.61 });
    expect(await getKitchen()).toMatchObject({ latitude: 33.59, longitude: -7.61 });
    expect(fakeWeather.geocodeCalls).toEqual(["Casablanca"]);
  });

  it("device coordinates win; nothing is looked up", async () => {
    await settings.updateKitchen({ ...KITCHEN, city: "Casablanca", latitude: 48.8566, longitude: 2.3522 });
    expect(await getKitchen()).toMatchObject({ latitude: 48.86, longitude: 2.35 });
    expect(fakeWeather.geocodeCalls).toEqual([]);
  });

  it("an unknown city is saved as typed, and the chip says it wasn't found", async () => {
    const { data } = await settings.updateKitchen({ ...KITCHEN, city: "Atlantis" });
    expect(data).toMatchObject({ city: "Atlantis", latitude: null });
    expect(await getWeatherChip()).toEqual({ status: "not_found", city: "Atlantis" });
  });
});

describe("the weather chip", () => {
  it("asks for a city until there's a location", async () => {
    expect(await getWeatherChip()).toEqual({ status: "no_location" });
  });

  it("shows the condition and numbers, with the mood ranking will use, and no coordinates", async () => {
    await settings.updateKitchen({ ...KITCHEN, latitude: 33.57, longitude: -7.59 });
    const chip = await getWeatherChip();
    expect(chip).toEqual({
      status: "ok",
      season: expect.stringMatching(/^(spring|summer|autumn|winter)$/),
      weather: {
        condition: "rainy",
        accent: null,
        tempC: 12,
        feelsLikeC: 10,
        windKmh: 18,
        precipMm: 0.6,
        isDay: true,
        mood: "cozy",
      },
    });
    expect(JSON.stringify(chip)).not.toMatch(/33\.5|open-meteo/);
  });

  it("neighbours share one cached reading (0.1° grid)", async () => {
    await settings.updateKitchen({ ...KITCHEN, latitude: 33.57, longitude: -7.59 });
    await getWeatherChip();
    browser.reset();
    await signUpAndVerify("karim@example.com");
    await logIn("karim@example.com");
    await settings.updateKitchen({ ...KITCHEN, latitude: 33.61, longitude: -7.56 });
    await getWeatherChip();
    expect(fakeWeather.forecastCalls).toBe(1);
  });

  it("hides itself when the provider is down", async () => {
    fakeWeather.fail = true;
    await settings.updateKitchen({ ...KITCHEN, latitude: 33.57, longitude: -7.59 });
    expect(await getWeatherChip()).toBeNull();
  });
});
