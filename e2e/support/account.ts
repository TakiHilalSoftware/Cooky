import { expect, type Page } from "@playwright/test";
import { createEmailVerificationToken } from "better-auth/api";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

export const PASSWORD = "Journey kitchen password 42";

/**
 * The link the confirmation email carries (same token, same callback).
 * Delivered links are scrubbed from the outbox, so it's built the way Better
 * Auth builds it: a token signed with the server's secret.
 */
export async function confirmationLink(baseURL: string, email: string): Promise<string> {
  const token = await createEmailVerificationToken(process.env.BETTER_AUTH_SECRET!, email);
  return `${baseURL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent("/en/verify-email/done")}`;
}

/** Signs up through the UI and confirms the email, ending signed in. */
export async function signUpAndConfirm(page: Page, baseURL: string, email: string) {
  await page.goto("/en/signup");
  await page.getByLabel("Your name").fill("Billing Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await page.goto(await confirmationLink(baseURL, email));
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
}
