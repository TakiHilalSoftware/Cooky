import { describe, expect, it } from "vitest";

import { SIGNED_IN_AREAS, signedOutRedirect } from "./gate";

describe("signedOutRedirect", () => {
  it("sends signed-out visitors of signed-in areas to log in, keeping where they were going", () => {
    expect(signedOutRedirect("/fr/settings/security", "?tab=2", false)).toBe(
      `/fr/login?next=${encodeURIComponent("/settings/security?tab=2")}`,
    );
  });

  it("uses the default language when the path has none", () => {
    expect(signedOutRedirect("/settings", "", false)).toBe(`/en/login?next=${encodeURIComponent("/settings")}`);
  });

  it("lets anyone with a session cookie through (the page validates it)", () => {
    expect(signedOutRedirect("/en/settings", "", true)).toBeNull();
  });

  it("protects My Dishes too, and brings the person back to the dish after logging in", () => {
    expect(signedOutRedirect("/fr/dishes/abc", "?servings=6", false)).toBe(
      `/fr/login?next=${encodeURIComponent("/dishes/abc?servings=6")}`,
    );
  });

  it.each(["/en/kitchen", "/en/onboarding"])("protects %s", (path) => {
    expect(signedOutRedirect(path, "", false)).toMatch(/^\/en\/login\?next=/);
  });

  it.each([
    "/en",
    "/en/login",
    "/ar/signup",
    "/en/terms",
    "/en/settingsx",
    "/en/discover",
    "/en/discover/harira",
    "/en/pricing",
  ])("leaves public page %s alone", (path) => {
    expect(signedOutRedirect(path, "", false)).toBeNull();
  });
});

describe("SIGNED_IN_AREAS", () => {
  it("covers every page folder of the signed-in (app) area, so none is left to the layout alone", async () => {
    const { readdirSync } = await import("node:fs");
    const folders = readdirSync("src/app/[locale]/(app)", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => `/${entry.name}`);
    expect([...SIGNED_IN_AREAS].sort()).toEqual(folders.sort());
  });
});
