import { describe, expect, it } from "vitest";

import { signedOutRedirect } from "./gate";

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

  it.each(["/en", "/en/login", "/ar/signup", "/en/terms", "/en/settingsx"])("leaves public page %s alone", (path) => {
    expect(signedOutRedirect(path, "", false)).toBeNull();
  });
});
