// Turns a user-agent string into what a person recognises: "Chrome on
// Windows". Deliberately small: only the browsers and systems people name.

export type DeviceKind = "computer" | "phone" | "tablet";
export type DeviceInfo = { browser: string | null; os: string | null; kind: DeviceKind };

// Order matters: Edge, Opera and Samsung Internet all also say "Chrome", and
// Chrome says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent ?? "";
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  const kind: DeviceKind =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
      ? "tablet"
      : /Mobi|iPhone|iPod/.test(ua)
        ? "phone"
        : "computer";
  return { browser, os, kind };
}
