import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import fr from "../messages/fr.json" with { type: "json" };

/** Phase 0 exit criteria plus the PRD §3.10 floor every later page inherits. */

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

test.describe("routing and languages", () => {
  test("the bare domain opens the default language", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What do I cook today?");
  });

  test("Arabic renders right-to-left", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ماذا أطبخ اليوم؟");
  });

  test("French renders left-to-right with its own copy", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(fr.home.headline);
  });

  test("switching language keeps you on the same page", async ({ page }) => {
    await page.goto("/en/some/old/link");
    await page.getByRole("button", { name: "Language: English" }).click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();
    await expect(page).toHaveURL(/\/fr\/some\/old\/link$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(fr.notFound.title);
  });
});

test.describe("not found", () => {
  test("an unknown page answers 404 with a translated way back", async ({ page }) => {
    const response = await page.goto("/fr/nope");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(fr.notFound.title);

    await page.getByRole("link", { name: fr.common.backToHome }).click();
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("an unknown locale falls back to the default language", async ({ page }) => {
    await page.goto("/xx/foo");
    await expect(page).toHaveURL(/\/en\/xx\/foo$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn't on the menu");
  });
});

test.describe("security", () => {
  test("every script runs under a per-request nonce", async ({ page }) => {
    const response = await page.goto("/en");
    const csp = response?.headers()["content-security-policy"] ?? "";
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).not.toContain("unsafe-eval");

    const scripts = await page
      .locator("script")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).nonce));
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every((n) => n === nonce)).toBe(true);

    const second = await page.request.get("/en");
    expect(second.headers()["content-security-policy"]).not.toContain(nonce);
  });

  test("the browser never calls a third party", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith("http") && url.origin !== origin) foreign.push(url.href);
    });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    expect(foreign).toEqual([]);
  });
});

test.describe("experience floor", () => {
  for (const path of ["/en", "/ar", "/fr/missing-page"]) {
    test(`${path} has no horizontal scroll at 320 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }

  test("the first Tab offers a skip link to the content", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium");
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("the chosen theme survives a reload", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("icon buttons explain themselves on hover", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover tooltips are a pointer affordance");
    await page.goto("/en");
    await page.getByRole("button", { name: "Change theme" }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Change theme");
  });
});

test.describe("accessibility (axe)", () => {
  test("home in light mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await expectAccessible(page);
  });

  test("home in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expectAccessible(page);
  });

  test("home in Arabic (RTL)", async ({ page }) => {
    await page.goto("/ar");
    await expectAccessible(page);
  });

  test("404 page", async ({ page }) => {
    await page.goto("/en/nope");
    await expectAccessible(page);
  });
});
