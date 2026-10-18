import { expect, test, type Page } from "@playwright/test";

import { signUpAndConfirm } from "./support/account";
import { expectAccessible, expectNoHorizontalScroll } from "./support/checks";

/**
 * Phase 3c: put a dish in a new collection from its page, browse the box by
 * collection, and download a backup (import is paid and covered by
 * integration tests). Checked for accessibility and 320 px on both projects.
 */

async function addDish(page: Page, name: string) {
  await page.goto("/en/dishes/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Ingredient" }).first().fill("Lentils");
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("collections and recipe backup", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  await signUpAndConfirm(page, baseURL!, `collections-${testInfo.project.name}-${Date.now()}@example.invalid`);
  await addDish(page, "Lemon chicken");
  await addDish(page, "Harira");

  // From the dish page: a new collection, ticked straight away.
  await page.getByRole("button", { name: "Choose collections for Harira" }).click();
  const dialog = page.getByRole("dialog", { name: "Collections for “Harira”" });
  await dialog.getByLabel("New collection name").fill("Ramadan");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "Ramadan" })).toBeChecked();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Collections updated")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ramadan" })).toBeVisible();

  // The box by collection.
  await page.goto("/en/dishes");
  const bar = page.getByRole("navigation", { name: "Collections" });
  await expect(bar.getByRole("link", { name: /Ramadan/ })).toContainText("1");
  await bar.getByRole("link", { name: /Ramadan/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Ramadan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Harira" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lemon chicken" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  // Your data: a backup downloads on every plan.
  await page.goto("/en/settings/data");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download backup (2 dishes)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^cooky-recipes-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText("Importing a backup is part of Plus and Pro.")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});
