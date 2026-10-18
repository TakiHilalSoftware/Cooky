import { describe, expect, it } from "vitest";

import { parseUserAgent } from "./user-agent";

describe("parseUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      { browser: "Chrome", os: "Windows", kind: "computer" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      { browser: "Edge", os: "Windows", kind: "computer" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      { browser: "Safari", os: "iOS", kind: "phone" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome", os: "Android", kind: "phone" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36",
      { browser: "Samsung Internet", os: "Android", kind: "tablet" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:140.0) Gecko/20100101 Firefox/140.0",
      { browser: "Firefox", os: "macOS", kind: "computer" },
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
      { browser: "Chrome", os: "iOS", kind: "tablet" },
    ],
  ])("%s", (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });

  it("copes with a missing or unknown user agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null, kind: "computer" });
    expect(parseUserAgent("curl/8.9.1")).toEqual({ browser: null, os: null, kind: "computer" });
  });
});
