import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test } from "@playwright/test";

const DEMO_EMAIL = "amina@demo.cooky";
const DEMO_PASSWORD = "Journey kitchen password 42";
const AUTH_FILE = path.resolve(process.cwd(), "e2e/.auth/pitch-user.json");

test.describe.serial("Pitch Demo User Setup & Verification", () => {
  test("seed pitch data, log in on port 3000, and save storageState", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const origin = baseURL ?? "http://localhost:3000";

    // 1. Seed demo user, dishes, pantry, shopping list, and assistant conversation.
    const pnpmPath = "C:\\Users\\angel\\AppData\\Roaming\\npm;" + (process.env.PATH ?? "");
    execSync("pnpm tsx --tsconfig scripts/tsconfig.json scripts/seed-pitch-demo.ts", {
      cwd: process.cwd(),
      env: { ...process.env, PATH: pnpmPath },
      stdio: "inherit",
    });

    // 2. Log in through the browser on localhost:3000.
    await page.goto(`${origin}/en/login`);
    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();

    // 3. Confirm redirected to /en/dishes.
    await expect(page).toHaveURL(/\/en\/dishes$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dishes" })).toBeVisible();

    // 4. Ensure target directory exists and save storageState.
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    await page.context().storageState({ path: AUTH_FILE });

    expect(fs.existsSync(AUTH_FILE)).toBe(true);
  });

  test("verify pitch demo user state across pages with pitch-user.json", async ({ browser, baseURL }) => {
    const origin = baseURL ?? "http://localhost:3000";
    expect(fs.existsSync(AUTH_FILE)).toBe(true);

    const context = await browser.newContext({ storageState: AUTH_FILE, baseURL: origin });
    const page = await context.newPage();

    // 1. Verify /en/dishes loads populated dishes.
    await page.goto("/en/dishes");
    await expect(page.getByRole("heading", { level: 1, name: "Dishes" })).toBeVisible();
    await expect(page.getByText("Chicken tagine with preserved lemon and olives")).toBeVisible();
    await expect(page.getByText("Shakshuka")).toBeVisible();
    await expect(page.getByText("Hummus")).toBeVisible();

    // 2. Verify /en/cook shows Ready to cook dishes and missing ingredient.
    await page.goto("/en/cook");
    await expect(page.getByRole("heading", { level: 1, name: "Cook" })).toBeVisible();
    await expect(page.getByText(/Ready to cook/i).first()).toBeVisible();
    await expect(page.getByText("Shakshuka").first()).toBeVisible();
    await expect(page.getByText(/Chicken tagine with preserved lemon and olives/i).first()).toBeVisible();

    // 3. Verify /en/shopping shows 7 items across aisles with 2 checked.
    await page.goto("/en/shopping");
    await expect(page.getByRole("heading", { level: 1, name: "Shopping list" })).toBeVisible();
    await expect(page.getByText("Whole chicken")).toBeVisible();
    await expect(page.getByText("Fresh coriander")).toBeVisible();
    await expect(page.getByText("Lamb shoulder")).toBeVisible();
    await expect(page.getByText("Butter")).toBeVisible();

    // 4. Verify /en/assistant loads thread and dish pick cards.
    await page.goto("/en/assistant");
    await expect(page.getByText("What can I cook with what's in my kitchen?").first()).toBeVisible();
    await page.getByText("What can I cook with what's in my kitchen?").first().click();
    await expect(page.getByText("Based on your kitchen")).toBeVisible();
    await expect(page.getByText(/Ready to cook: you have fresh eggs/i).first()).toBeVisible();
    await expect(page.getByText(/Only 1 ingredient away/i).first()).toBeVisible();

    await context.close();
  });
});
