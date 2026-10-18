import { describe, expect, it } from "vitest";

import { nextHeaders } from "../../../tests/setup/next-headers";

import { clientIp, requestLocale } from "./request-info";

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(null)).toBeNull();
  });

  // Regression: Next 16 headers() returns a HeadersAdapter with its own
  // `.headers` property; duck-typing on it crashed every public action.
  it("reads the real object Next 16 returns from headers()", () => {
    expect(clientIp(nextHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(requestLocale(nextHeaders({ cookie: "NEXT_LOCALE=ar" }))).toBe("ar");
  });

  it("reads from a Request too", () => {
    expect(clientIp(new Request("https://x.test", { headers: { "x-forwarded-for": "192.0.2.1" } }))).toBe("192.0.2.1");
  });
});

describe("requestLocale", () => {
  it("prefers the language the visitor picked on the site", () => {
    expect(requestLocale(new Headers({ cookie: "a=1; NEXT_LOCALE=ar", "accept-language": "fr-FR" }))).toBe("ar");
  });

  it("falls back to the browser language", () => {
    expect(requestLocale(new Headers({ "accept-language": "de-DE,fr;q=0.8" }))).toBe("fr");
  });

  it("defaults to English for anything else", () => {
    expect(requestLocale(new Headers({ cookie: "NEXT_LOCALE=xx", "accept-language": "de" }))).toBe("en");
    expect(requestLocale(null)).toBe("en");
  });
});
