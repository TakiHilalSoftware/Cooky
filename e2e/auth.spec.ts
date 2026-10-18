import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

import { confirmationLink, PASSWORD } from "./support/account";

/**
 * Phase 1 release journey (docs/ROADMAP.md): sign up → confirm the email →
 * log in → turn on 2FA → log in with a code on a second device → sign that
 * device out from the first → log out. Runs against the production build and
 * a fresh test database with email delivery off.
 */

async function logIn(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

async function logOut(page: Page) {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/en$/);
}

test("sign up, confirm, log in, 2FA, revoke a device, log out", async ({ page, browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one full journey is enough; layouts are covered elsewhere");
  test.setTimeout(120_000);
  const email = `journey-${Date.now()}@example.com`;

  // Sign up.
  await page.goto("/en/signup");
  await page.getByLabel("Your name").fill("Journey Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  // Confirm the email from the link: signed in straight away.
  await page.goto(await confirmationLink(baseURL!, email));
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/en\/settings$/);

  // Log out, log back in with the password.
  await logOut(page);
  await logIn(page, email);
  await expect(page).toHaveURL(/\/en\/settings$/);

  // Turn on 2FA.
  await page.goto("/en/settings/security");
  await page.getByRole("button", { name: "Turn on" }).click();
  await page.getByRole("dialog").getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const secret = (await page.getByRole("dialog").locator("code").textContent())!.trim();
  const code = () => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
  await page.getByRole("dialog").locator("input").first().click();
  await page.keyboard.type(code());
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByRole("heading", { name: "Save your backup codes" })).toBeVisible();
  await page.getByRole("button", { name: "I've saved them" }).click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();

  // A second device: password, then the code.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await logIn(other, email);
  await expect(other).toHaveURL(/\/en\/two-factor/);
  await other.locator("input").first().click();
  await other.keyboard.type(code());
  await expect(other).toHaveURL(/\/en\/settings$/);

  // Sign the second device out from the first.
  await page.reload();
  const devices = page.getByRole("region", { name: "Logged-in devices" });
  await expect(devices.getByRole("listitem")).toHaveCount(2); // this device and the second one
  const otherDevice = devices
    .getByRole("listitem")
    .filter({ hasNot: page.getByText("This device") })
    .last();
  await otherDevice.getByRole("button", { name: /^Sign out / }).click();
  await expect(page.getByText("Device signed out.")).toBeVisible();

  await other.goto("/en/settings");
  await expect(other).toHaveURL(/\/en\/login/);
  await otherContext.close();

  // Log out.
  await logOut(page);
  await page.goto("/en/settings");
  await expect(page).toHaveURL(/\/en\/login/);
});
