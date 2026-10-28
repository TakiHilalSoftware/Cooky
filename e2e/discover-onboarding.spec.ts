import { expect, test } from "@playwright/test";

import { confirmationLink, PASSWORD } from "./support/account";
import { expectAccessible, expectNoHorizontalScroll } from "./support/checks";

/**
 * Phase 3d: a visitor browses Discover and a dish; a new account goes
 * through the starter pack and lands on a box with its picks.
 */

test("a visitor browses Discover and a dish, and is invited to sign up to save", async ({ page }) => {
  await page.goto("/en/discover");
  await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Featured dishes" }).getByRole("listitem").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.getByLabel("Ingredients you have").fill("chickpeas, tahini");
  await page.getByRole("button", { name: "Show dishes" }).click();
  await expect(page.getByRole("link", { name: "Hummus" })).toBeVisible();
  await page.getByRole("link", { name: "Hummus" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hummus" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in to save" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("a new account goes through the starter pack and starts with its picks", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const email = `starter-${testInfo.project.name}-${Date.now()}@example.invalid`;
  await page.goto("/en/signup");
  await page.getByLabel("Your name").fill("Starter Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await page.goto(await confirmationLink(baseURL!, email));
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/en\/onboarding$/);
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await page.getByLabel("City").fill("Casablanca");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Halal" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Staples are optional: carry on to the favorites.
  await expect(page.getByText("Step 4 of 5")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 5 of 5")).toBeVisible();

  const finish = page.getByRole("button", { name: "Finish" });
  await expect(finish).toBeDisabled();
  const picks = page.locator("main button[aria-pressed]");
  for (let i = 0; i < 3; i++) await picks.nth(i).click();
  await expect(page.getByText("3 picked")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await finish.click();

  await expect(page).toHaveURL(/\/en\/cook$/);
  await expect(page.getByText(/Welcome! 3 dishes are in your box\./)).toBeVisible();
  await expect(page.getByRole("region", { name: "Dishes, best match first" }).locator("ol > li")).toHaveCount(3);
  await expect(page.getByText("Finish setting up your kitchen")).toHaveCount(0);
});
