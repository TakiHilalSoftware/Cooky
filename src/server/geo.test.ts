import { describe, expect, it } from "vitest";

import { devOverride, geoFromHeaders } from "./geo";

const headers = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe("geoFromHeaders", () => {
  it("reads Vercel's headers, coordinates rounded to about 1 km like a saved place", () => {
    expect(
      geoFromHeaders(
        headers({
          "x-vercel-ip-city": "Algiers",
          "x-vercel-ip-country": "DZ",
          "x-vercel-ip-latitude": "36.7538",
          "x-vercel-ip-longitude": "3.0588",
        }),
      ),
    ).toEqual({ city: "Algiers", country: "DZ", latitude: 36.75, longitude: 3.06 });
  });

  it("decodes city names sent percent-encoded (RFC 3986)", () => {
    expect(geoFromHeaders(headers({ "x-vercel-ip-city": "S%C3%A9tif" })).city).toBe("Sétif");
    expect(geoFromHeaders(headers({ "x-vercel-ip-city": "Tizi%20Ouzou" })).city).toBe("Tizi Ouzou");
  });

  it("leaves out anything malformed instead of guessing", () => {
    expect(
      geoFromHeaders(
        headers({
          "x-vercel-ip-city": "%E0%A4%A",
          "x-vercel-ip-country": "Algeria",
          "x-vercel-ip-latitude": "91",
          "x-vercel-ip-longitude": "3.05",
        }),
      ),
    ).toEqual({ city: null, country: null, latitude: null, longitude: null });
  });

  it("never returns half a position", () => {
    const geo = geoFromHeaders(headers({ "x-vercel-ip-latitude": "36.75", "x-vercel-ip-longitude": "" }));
    expect([geo.latitude, geo.longitude]).toEqual([null, null]);
  });

  it("is empty off Vercel (no headers)", () => {
    expect(geoFromHeaders(() => null)).toEqual({ city: null, country: null, latitude: null, longitude: null });
  });
});

describe("devOverride", () => {
  it("stands in for the headers in development, accents and all", () => {
    expect(geoFromHeaders(devOverride("Sétif|36.19|5.41|dz"))).toEqual({
      city: "Sétif",
      country: "DZ",
      latitude: 36.19,
      longitude: 5.41,
    });
  });
});
