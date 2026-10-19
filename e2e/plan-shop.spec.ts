import { expect, test, type Page } from "@playwright/test";

import { signUpAndConfirm } from "./support/account";
import { expectAccessible, expectNoHorizontalScroll } from "./support/checks";

/**
 * Phase 4 and 5 exit journeys (ROADMAP): decide what to cook without any
 * third-party request in the browser; plan → shop → merged totals → check off
 * offline → sync on reconnect; logout wipes the offline copy.
 */

async function addDish(page: Page, name: string, lines: { amount: string; ingredient: string }[]) {
  await page.goto("/en/dishes/new");
  await page.getByLabel("Name").fill(name);
  const rows = page.getByRole("region", { name: "Ingredients" }).getByRole("listitem");
  for (const [i, line] of lines.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Add ingredient" }).click();
    await rows.nth(i).getByLabel("Amount").fill(line.amount);
    await rows.nth(i).getByRole("combobox", { name: "Ingredient" }).fill(line.ingredient);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

const offlineKeys = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open("cooky-offline", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("kv");
        open.onsuccess = () => {
          const request = open.result.transaction("kv", "readonly").objectStore("kv").getAllKeys();
          request.onsuccess = () => resolve(request.result.map(String));
          request.onerror = () => resolve([]);
        };
        open.onerror = () => resolve([]);
      }),
  );

test("decide what to cook from the kitchen, with no third-party request in the browser", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(150_000);
  const outside: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).host;
    if (host !== new URL(baseURL!).host) outside.push(host);
  });
  await signUpAndConfirm(page, baseURL!, `decide-${testInfo.project.name}-${Date.now()}@example.invalid`);
  await addDish(page, "Omelette", [{ amount: "3", ingredient: "Eggs" }]);
  await addDish(page, "Lentil soup", [
    { amount: "250", ingredient: "Lentils" },
    { amount: "1", ingredient: "Onion" },
  ]);

  await page.goto("/en/kitchen");
  await page.getByLabel("Add an ingredient").fill("eggs");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("“eggs” added")).toBeVisible();

  await page.goto("/en/cook");
  // The cards themselves (each card has its own little list of badges).
  const cards = page.getByRole("region", { name: "Dishes, best match first" }).locator("ol > li");
  await expect(cards.first()).toContainText("Omelette");
  await expect(cards.first()).toContainText("Ready to cook");
  await expect(cards.nth(1)).toContainText("2 missing");
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await cards.first().getByRole("button", { name: "Log it for today" }).click();
  await expect(page.getByText("“Omelette” logged for today")).toBeVisible();

  await page.goto("/en/spin");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(page.getByRole("button", { name: "Not now" })).toBeVisible({ timeout: 15_000 });
  await expectAccessible(page);

  expect(outside, "the browser only talks to Cooky").toEqual([]);
});

test("plan the week, shop once, tick offline, sync, and log out clean", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  await signUpAndConfirm(page, baseURL!, `plan-${testInfo.project.name}-${Date.now()}@example.invalid`);
  await addDish(page, "Onion soup", [{ amount: "2", ingredient: "Onions" }]);
  await addDish(page, "Onion tart", [{ amount: "3", ingredient: "onion" }]);

  // Plan both on Monday: "+" opens the dish picker on every screen size.
  await page.goto("/en/planner");
  const monday = page.getByRole("main").locator("ol > li").first();
  for (const name of ["Onion soup", "Onion tart"]) {
    await monday.getByRole("button", { name: "Add a dish" }).click();
    await page.getByRole("dialog").getByRole("button", { name }).click();
    await expect(monday).toContainText(name);
  }
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: "Shop for this week" }).click();
  await expect(page.getByText(/added to your shopping list/)).toBeVisible();

  // One merged line: 2 + 3 onions.
  await page.goto("/en/shopping");
  const onion = page.getByRole("main").getByRole("listitem").filter({ hasText: "Onion" });
  await expect(onion).toHaveCount(1);
  await expect(onion).toContainText("5");
  await expect(onion).toContainText("for 2 dishes");
  await expectAccessible(page);

  // The service worker takes over, then the connection drops.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(async () => (await offlineKeys(page)).includes("snapshot")).toBe(true);

  await context.setOffline(true);
  await page.goto("/en/shopping").catch(() => undefined);
  await expect(page.getByRole("status")).toContainText("offline");
  await page.getByRole("checkbox").first().check();
  await expect(page.getByText("1 of 1 in the basket")).toBeVisible();

  // Back online: the queued tick reaches the server.
  await context.setOffline(false);
  // The offline page reloads itself when the connection comes back; let that finish first.
  await page.waitForTimeout(2_000);
  await page.goto("/en/shopping").catch(() => undefined);
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByRole("main").getByRole("checkbox", { checked: true }).count();
      },
      { timeout: 20_000 },
    )
    .toBe(1);

  // Logging out wipes this device's copy.
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL(/\/en(\/login)?$/);
  await expect.poll(() => offlineKeys(page)).toEqual([]);
});
