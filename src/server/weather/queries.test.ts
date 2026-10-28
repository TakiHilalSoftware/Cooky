import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestGeo } from "@/server/geo";

const { loadProfile, requestGeo, fetchCurrent } = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  requestGeo: vi.fn(),
  fetchCurrent: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({ getSession: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/server/features/profile/queries", () => ({ loadProfile }));
vi.mock("@/server/geo", () => ({ requestGeo }));
vi.mock("./cache", () => ({ weatherKey: () => "k", cachedReading: (_key: string, read: () => unknown) => read() }));
vi.mock("./client", () => ({ fetchCurrent }));

const { getWeatherChip, loadWeatherContext } = await import("./queries");

const SUNNY = { tempC: 22, feelsLikeC: 21, windKmh: 8, precipMm: 0, weatherCode: 0, isDay: true };
const ALGIERS_BY_IP: RequestGeo = { city: "Algiers", country: "DZ", latitude: 36.75, longitude: 3.06 };
const NOWHERE: RequestGeo = { city: null, country: null, latitude: null, longitude: null };
const profile = (place: { city?: string | null; latitude?: number | null; longitude?: number | null }) => ({
  city: null,
  latitude: null,
  longitude: null,
  ...place,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchCurrent.mockResolvedValue(SUNNY);
  requestGeo.mockResolvedValue(ALGIERS_BY_IP);
});

describe("the weather's place", () => {
  it("is the person's own place when set, and the connection is never consulted", async () => {
    loadProfile.mockResolvedValue(profile({ city: "Oran", latitude: 35.7, longitude: -0.63 }));
    const chip = await getWeatherChip();
    expect(chip).toMatchObject({ status: "ok", approximate: null });
    expect(fetchCurrent).toHaveBeenCalledWith(35.7, -0.63);
    expect(requestGeo).not.toHaveBeenCalled();
  });

  it("without any place, is the connection's (approximate, said so, not saved)", async () => {
    loadProfile.mockResolvedValue(profile({}));
    const chip = await getWeatherChip();
    expect(chip).toMatchObject({ status: "ok", approximate: { city: "Algiers" } });
    expect(fetchCurrent).toHaveBeenCalledWith(36.75, 3.06);
  });

  it("never replaces a city of theirs we couldn't find with a guess", async () => {
    loadProfile.mockResolvedValue(profile({ city: "Atlantis" }));
    expect(await getWeatherChip()).toEqual({ status: "not_found", city: "Atlantis" });
    expect(requestGeo).not.toHaveBeenCalled();
    expect(fetchCurrent).not.toHaveBeenCalled();
  });

  it("asks for a city when neither the person nor the connection says where", async () => {
    loadProfile.mockResolvedValue(profile({}));
    requestGeo.mockResolvedValue(NOWHERE);
    expect(await getWeatherChip()).toEqual({ status: "no_location" });
  });

  it("hides the chip when their place is set but the provider is down", async () => {
    loadProfile.mockResolvedValue(profile({ city: "Oran", latitude: 35.7, longitude: -0.63 }));
    fetchCurrent.mockRejectedValue(new Error("timeout"));
    expect(await getWeatherChip()).toBeNull();
  });

  it("ranking reads the same approximate weather, and its hemisphere for the season", async () => {
    loadProfile.mockResolvedValue(profile({}));
    const context = await loadWeatherContext("u1", new Date("2026-10-28T10:00:00Z"));
    expect(context).toMatchObject({ approximate: { city: "Algiers" }, season: "autumn" });
    expect(context.weather?.tempC).toBe(22);
  });
});
