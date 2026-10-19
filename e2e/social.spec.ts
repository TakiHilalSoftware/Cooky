import { expect, test, type Browser } from "@playwright/test";

import { signUpAndConfirm } from "./support/account";
import { expectAccessible, expectNoHorizontalScroll } from "./support/checks";

/**
 * Phase 6 exit journey (ROADMAP): two people find each other, chat with
 * receipts, and the safety rules hold: an unfriended chat is read-only and a
 * blocked person can't find, add or message.
 */

async function personIn(
  browser: Browser,
  baseURL: string,
  email: string,
  viewport: { width: number; height: number } | null,
) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await signUpAndConfirm(page, baseURL, email);
  return page;
}

test("two people become friends, chat, then unfriend and block", async ({
  browser,
  baseURL,
  page: first,
}, testInfo) => {
  test.setTimeout(240_000);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const aminaEmail = `amina-${stamp}@example.invalid`;
  const linaEmail = `lina-${stamp}@example.invalid`;
  const amina = await personIn(browser, baseURL!, aminaEmail, first.viewportSize());
  const lina = await personIn(browser, baseURL!, linaEmail, first.viewportSize());

  // Amina finds Lina by her exact email (names alone never reveal emails) and asks.
  await amina.goto("/en/friends");
  await expect(amina.getByRole("heading", { level: 1, name: "Friends" })).toBeVisible();
  await expectAccessible(amina);
  await expectNoHorizontalScroll(amina);
  await amina.getByLabel("Name or email").fill(linaEmail);
  await amina.getByRole("button", { name: "Add friend" }).click();
  // "Requested" shows at once; the toast means the server has the request.
  await expect(amina.getByText("Friend request sent to Billing Tester.")).toBeVisible();
  await expect(amina.getByRole("button", { name: "Requested" }).first()).toBeVisible();

  // Lina sees the request and accepts.
  await lina.goto("/en/friends");
  const requests = lina.getByRole("region", { name: /Friend requests/ });
  await expect(requests).toBeVisible();
  await requests.getByRole("button", { name: "Accept" }).click();
  await expect(lina.getByText("You and Billing Tester are now friends.")).toBeVisible();

  // Amina opens the chat from Friends and writes.
  await amina.reload();
  await amina.getByRole("button", { name: "Message" }).first().click();
  await expect(amina).toHaveURL(/\/en\/messages\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const thread = amina.url();
  await amina.getByRole("textbox", { name: /Message to/ }).fill("Salam! Dinner on Friday?");
  await amina.keyboard.press("Enter");
  await expect(amina.getByText("Salam! Dinner on Friday?")).toBeVisible();
  await expectAccessible(amina);
  await expectNoHorizontalScroll(amina);

  // Lina has an unread chat, reads it and answers.
  await lina.goto("/en/messages");
  await expect(lina.getByText("Unread", { exact: true })).toBeAttached();
  await lina.getByRole("link", { name: /Billing Tester/ }).click();
  await expect(lina.getByText("Salam! Dinner on Friday?")).toBeVisible();
  await lina.getByRole("textbox", { name: /Message to/ }).fill("Yes! I'll bring dessert.");
  await lina.getByRole("button", { name: "Send" }).click();

  // Amina's open chat picks up the answer (realtime, or the short refresh without it), then "Seen".
  await expect(amina.getByText("Yes! I'll bring dessert.")).toBeVisible({ timeout: 20_000 });
  await expect(amina.getByText("Seen")).toBeVisible({ timeout: 20_000 });

  // Lina unfriends: the chat stays readable but read-only.
  await lina.goto("/en/friends");
  await lina
    .getByRole("button", { name: /More for/ })
    .first()
    .click();
  await lina.getByRole("menuitem", { name: "Unfriend" }).click();
  await lina.getByRole("alertdialog").getByRole("button", { name: "Unfriend" }).click();
  await expect(lina.getByText(/You're no longer friends with/)).toBeVisible();
  await amina.goto(thread);
  await expect(amina.getByText(/this chat is read-only/)).toBeVisible();
  await expect(amina.getByRole("textbox", { name: /Message to/ })).toHaveCount(0);

  // Lina blocks Amina from her profile: Amina can no longer find or add her.
  await lina.getByLabel("Name or email").fill(aminaEmail);
  await lina.getByRole("link", { name: "Billing Tester" }).click();
  await lina.getByRole("button", { name: /More for/ }).click();
  await lina.getByRole("menuitem", { name: "Block" }).click();
  await lina.getByRole("alertdialog").getByRole("button", { name: "Block" }).click();
  await expect(lina).toHaveURL(/\/en\/friends$/, { timeout: 30_000 });

  await amina.goto("/en/friends");
  await amina.getByLabel("Name or email").fill(linaEmail);
  await expect(amina.getByText(/No one found with that exact email/)).toBeVisible();

  // Lina finds the block in Settings, where she can undo it.
  await lina.goto("/en/settings/privacy");
  await expect(lina.getByRole("button", { name: /Unblock Billing Tester/ })).toBeVisible();
  await expectAccessible(lina);
});
