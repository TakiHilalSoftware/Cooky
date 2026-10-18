import { expect, test } from "@playwright/test";

import { signUpAndConfirm } from "./support/account";
import { expectAccessible, expectNoHorizontalScroll } from "./support/checks";

/**
 * My Dishes (Phase 3a): empty box → add a dish → scale it → star it → note →
 * find it → delete with Undo. Checked for accessibility and 320 px on both
 * projects. The dish cap and read-only rules are covered by integration tests.
 */
test("add, scale, star, find, delete and undo a dish", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  await signUpAndConfirm(page, baseURL!, `dishes-${testInfo.project.name}-${Date.now()}@example.invalid`);

  // An empty box says what it's for and offers the next step.
  await page.goto("/en/dishes");
  await expect(page.getByRole("heading", { name: "No dishes yet" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
  await page.getByRole("link", { name: "Add a dish" }).click();

  // The form explains mistakes before calling the server.
  await expect(page.getByRole("heading", { level: 1, name: "Add a dish" })).toBeVisible();
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect(page.getByLabel("Name")).toBeFocused();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.getByLabel("Name").fill("Chicken tagine with olives");
  const ingredients = page.getByRole("region", { name: "Ingredients" }).getByRole("listitem");
  await ingredients.nth(0).getByLabel("Amount").fill("1,2");
  await ingredients.nth(0).getByLabel("Unit").selectOption("kg");
  await ingredients.nth(0).getByLabel("Ingredient", { exact: true }).fill("Chicken thighs");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await ingredients.nth(1).getByLabel("Ingredient", { exact: true }).fill("Salt");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("What to do").fill("Brown the chicken, then simmer.");
  await page.getByLabel("Timer (minutes)").fill("45");
  await page.getByRole("button", { name: "Add dish" }).click();

  // The dish page, scaled on the server.
  await expect(page.getByRole("heading", { level: 1, name: "Chicken tagine with olives" })).toBeVisible();
  await expect(page.getByText("“Chicken tagine with olives” added")).toBeVisible();
  const chicken = page.getByRole("listitem").filter({ hasText: "Chicken thighs" });
  await expect(chicken).toContainText("1.2 kg");
  await expect(page.getByRole("listitem").filter({ hasText: "Salt" })).toContainText("to taste");
  await page.getByRole("link", { name: "More servings" }).click();
  await page.getByRole("link", { name: "More servings" }).click();
  await expect(page.getByText("6 servings")).toBeVisible();
  await expect(chicken).toContainText("1.8 kg");
  await expect(page.getByText("Scaled from 4 servings")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: "Add Chicken tagine with olives to favorites" }).click();
  await expect(page.getByRole("button", { name: "Remove Chicken tagine with olives from favorites" })).toBeVisible();
  await page.getByLabel("Your notes on this dish").fill("Less salt next time");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();

  // Find it again: a typo and favorites-only both work.
  await page.goto("/en/dishes?favorites=1");
  await page.getByLabel("Search your dishes").fill("tajin");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: "Chicken tagine with olives" })).toBeVisible();
  await expect(page.getByText("1 dish", { exact: true })).toBeVisible();

  // Delete at once, then Undo.
  await page.getByRole("link", { name: "Chicken tagine with olives" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "No dishes yet" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("“Chicken tagine with olives” is back")).toBeVisible();
  await expect(page.getByRole("link", { name: "Chicken tagine with olives" })).toBeVisible();
  // The note survived the round trip.
  await page.getByRole("link", { name: "Chicken tagine with olives" }).click();
  await expect(page.getByLabel("Your notes on this dish")).toHaveValue("Less salt next time");
});
