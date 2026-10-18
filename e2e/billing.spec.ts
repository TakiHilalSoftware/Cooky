import { expect, test, type Page } from "@playwright/test";

import { signUpAndConfirm } from "./support/account";
import { expectAccessible, expectNoHorizontalScroll } from "./support/checks";
import {
  cancelAtPeriodEnd,
  cancelNow,
  changePlan,
  clockCustomer,
  deleteCustomerOf,
  deliverStripeEvent,
  runReconcile,
  sql,
  stripeConfigured,
  userIdOf,
} from "./support/stripe";

/**
 * Phase 2 exit criteria (docs/ROADMAP.md): trial → paid, upgrade, cancel, and
 * failed payment → grace → Free, in Stripe test mode, checked on the screens
 * people use: Pricing, the upgrade sheet and Settings → Plan & billing.
 */

const plan = (page: Page) => page.getByRole("region", { name: "Your plan" });
/** One feature's tries meter on Plan & billing. */
const meter = (page: Page, feature: string) =>
  page.getByRole("region", { name: "Tries" }).getByRole("listitem").filter({ hasText: feature });

async function openBilling(page: Page, query = "") {
  await page.goto(`/en/settings/billing${query}`);
  await expect(plan(page)).toBeVisible();
}

test.describe("Pricing (public)", () => {
  test("is readable, accessible and fits the screen, and explains a cancelled checkout", async ({ page }) => {
    await page.goto("/en/pricing?checkout=cancelled");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick the plan that fits your kitchen");
    await expect(page.getByRole("status").filter({ hasText: "Checkout cancelled" })).toContainText(
      "You weren't charged.",
    );
    // Limits come from plan_limits (seeded), prices from the plan config.
    await expect(page.getByRole("listitem", { name: "Plus" })).toContainText("150 questions a month");
    await page.getByRole("radio", { name: /Yearly/ }).click();
    await expect(page.getByRole("listitem", { name: "Plus" })).toContainText("€35.99");
    // Signed out, a trial starts with an account.
    await page.getByRole("listitem", { name: "Plus" }).getByRole("link", { name: "Start 7-day free trial" }).click();
    await expect(page).toHaveURL(/\/en\/signup$/);
    await page.goBack();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });
});

test.describe("billing journeys (Stripe test mode)", () => {
  test.skip(!stripeConfigured, "needs STRIPE_SECRET_KEY (test mode) and synced prices: pnpm stripe:sync");
  test.describe.configure({ mode: "serial" });

  test("trial → paid → upgrade → cancel → Free", async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one journey is enough; layouts are covered elsewhere");
    test.setTimeout(300_000);
    const email = `billing-trial-${Date.now()}@example.invalid`;
    await signUpAndConfirm(page, baseURL!, email);
    const userId = await userIdOf(email);

    // Pricing → our server opens a real Stripe Checkout session with the trial.
    await page.goto("/en/pricing");
    await page.getByRole("button", { name: "Start 7-day free trial: Plus" }).click();
    await page.waitForURL(/checkout\.stripe\.com/);
    await deleteCustomerOf(userId);

    // The customer completes checkout (Stripe API on a test clock stands in for the hosted form).
    const customer = await clockCustomer(userId, email);
    try {
      const sub = await customer.subscribe("cooky_plus_month", { trialDays: 7 });

      // Back on the success page before the webhook: Free, and "Finishing up".
      await openBilling(page, "?checkout=success");
      await expect(page.getByRole("status").filter({ hasText: "Finishing up…" })).toBeVisible();
      await deliverStripeEvent(baseURL!, "customer.subscription.created", sub.id);
      // The page re-reads the server by itself; no reload.
      await expect(page.getByText("You're on Plus")).toBeVisible({ timeout: 15_000 });
      await expect(plan(page)).toContainText("Free trial");
      await expect(plan(page)).toContainText(/Your free trial ends on .+ After that it's €3\.99 a month/);
      await expect(meter(page, "AI Assistant")).toContainText("150 of 150 left");

      // The trial ends and the card is charged.
      await customer.advance(7.1);
      await deliverStripeEvent(baseURL!, "invoice.paid", sub.id);
      await openBilling(page);
      await expect(plan(page)).toContainText("Paid");
      await expect(plan(page)).toContainText(/Renews on .+ for €3\.99 a month\./);

      // Upgrade to Pro (what the Customer Portal does).
      await changePlan(sub.id, "cooky_pro_month");
      await deliverStripeEvent(baseURL!, "customer.subscription.updated", sub.id);
      await openBilling(page);
      await expect(plan(page)).toContainText("Pro");
      await expect(plan(page)).toContainText("€7.99 a month");
      await expect(meter(page, "AI Assistant")).toContainText("600 of 600 left");

      // Cancel at period end: the plan stays, with a way back.
      await cancelAtPeriodEnd(sub.id);
      await deliverStripeEvent(baseURL!, "customer.subscription.updated", sub.id);
      await openBilling(page);
      await expect(plan(page)).toContainText(/Cancelled\. You keep Pro until .+, then move to Free\./);
      await expect(plan(page).getByRole("button", { name: "Keep my plan" })).toBeVisible();

      // The period ends: Free, nothing to renew, and the trial isn't offered again.
      await cancelNow(sub.id);
      await deliverStripeEvent(baseURL!, "customer.subscription.deleted", sub.id);
      await openBilling(page);
      await expect(plan(page)).toContainText(/Free, with no time limit/);
      await expect(plan(page)).not.toContainText("free trial is still available");
      await page.goto("/en/pricing");
      await expect(page.getByRole("button", { name: "Upgrade to Plus" })).toBeVisible();
    } finally {
      await customer.cleanup();
    }
  });

  test("failed payment → 7-day grace → Free", async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one journey is enough; layouts are covered elsewhere");
    test.setTimeout(300_000);
    const email = `billing-grace-${Date.now()}@example.invalid`;
    await signUpAndConfirm(page, baseURL!, email);
    const userId = await userIdOf(email);
    const customer = await clockCustomer(userId, email);
    try {
      const sub = await customer.subscribe("cooky_plus_month");
      await deliverStripeEvent(baseURL!, "customer.subscription.created", sub.id);
      await openBilling(page);
      await expect(plan(page)).toContainText(/Renews on/);

      // The renewal charge is declined.
      await customer.useFailingCard();
      await customer.advance(31.1);
      await deliverStripeEvent(baseURL!, "invoice.payment_failed", sub.id);
      await openBilling(page);
      const alert = plan(page).getByRole("alert");
      await expect(alert).toContainText("Your last payment didn't go through");
      await expect(alert).toContainText(/Update your card by .+ to keep Plus\./);
      await expect(alert.getByRole("button", { name: "Update card" })).toBeVisible();
      // Still Plus during the grace period.
      await expect(meter(page, "AI Assistant")).toContainText("150 of 150 left");

      // Seven days later, still unpaid: the nightly reconcile moves the account to Free.
      await sql(`update subscriptions set payment_failed_at = now() - interval '8 days' where id = $1`, [sub.id]);
      expect((await runReconcile(baseURL!)).changed).toBeGreaterThanOrEqual(1);
      await openBilling(page);
      await expect(plan(page)).toContainText(/Free, with no time limit/);
      await expect(plan(page).getByRole("alert")).toHaveCount(0);
      await expect(meter(page, "AI Assistant")).toContainText("10 of 10 left");
    } finally {
      await customer.cleanup();
    }
  });

  test("out of tries → upgrade sheet → Stripe Checkout", async ({ page, baseURL }, testInfo) => {
    const email = `billing-sheet-${testInfo.project.name}-${Date.now()}@example.invalid`;
    await signUpAndConfirm(page, baseURL!, email);
    const userId = await userIdOf(email);
    try {
      // All 10 Free Assistant questions spent this month.
      await sql(
        `insert into usage_counters (user_id, feature, period_start, used)
         values ($1, 'assistant', date_trunc('month', now() at time zone 'utc') at time zone 'utc', 10)`,
        [userId],
      );
      await openBilling(page);
      await expect(meter(page, "AI Assistant")).toContainText("None left");
      await page.getByRole("button", { name: "Get more: AI Assistant" }).click();

      const sheet = page.getByRole("dialog", { name: "You've used all 10 questions for this month" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("Your tries come back on");
      await expect(sheet).toContainText("150 questions a month");
      await expect(sheet).toContainText("600 questions a month");
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);

      // It closes in one tap…
      await sheet.getByRole("button", { name: "Not now" }).click();
      await expect(sheet).toBeHidden();
      // …and leads straight to checkout.
      await page.getByRole("button", { name: "Get more: AI Assistant" }).click();
      await sheet.getByRole("button", { name: "Start 7-day free trial: Plus" }).click();
      await page.waitForURL(/checkout\.stripe\.com/);
    } finally {
      await deleteCustomerOf(userId);
    }
  });
});
