import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

/** Injects a clean, high-visibility pointer dot, outer ring, and click-pulse for 1080p recording. */
async function injectPitchCursor(page: Page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const existing = document.getElementById("pitch-recording-cursor");
    if (existing) return;

    const cursor = document.createElement("div");
    cursor.id = "pitch-recording-cursor";
    cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 18px;
      height: 18px;
      margin-left: -9px;
      margin-top: -9px;
      border-radius: 50%;
      background: #f97316;
      border: 2.5px solid #ffffff;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      z-index: 2147483647;
      transition: transform 0.08s ease-out, background 0.12s ease-out;
      transform: translate3d(-100px, -100px, 0);
    `;

    const ring = document.createElement("div");
    ring.id = "pitch-recording-ring";
    ring.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 40px;
      height: 40px;
      margin-left: -20px;
      margin-top: -20px;
      border-radius: 50%;
      border: 2px solid rgba(249, 115, 22, 0.55);
      background: rgba(249, 115, 22, 0.08);
      pointer-events: none;
      z-index: 2147483646;
      transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
      transform: translate3d(-100px, -100px, 0);
    `;

    const pulse = document.createElement("div");
    pulse.id = "pitch-recording-pulse";
    pulse.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 56px;
      height: 56px;
      margin-left: -28px;
      margin-top: -28px;
      border-radius: 50%;
      border: 2.5px solid #ea580c;
      background: rgba(234, 88, 12, 0.25);
      pointer-events: none;
      z-index: 2147483645;
      opacity: 0;
      transform: scale(0.4);
      transition: opacity 0.35s ease-out, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    `;

    document.documentElement.appendChild(cursor);
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(pulse);

    window.addEventListener(
      "mousemove",
      (e) => {
        cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      },
      { passive: true },
    );

    window.addEventListener(
      "mousedown",
      (e) => {
        cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(0.85)`;
        cursor.style.background = "#ea580c";
        pulse.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(0.4)`;
        pulse.style.opacity = "1";
        requestAnimationFrame(() => {
          pulse.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(1.35)`;
          pulse.style.opacity = "0";
        });
      },
      { passive: true },
    );

    window.addEventListener(
      "mouseup",
      (e) => {
        cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(1)`;
        cursor.style.background = "#f97316";
      },
      { passive: true },
    );
  });
}

/** Smoothly moves the mouse to the center of a locator. */
async function smoothMoveTo(page: Page, locatorOrPoint: Locator | { x: number; y: number }, steps = 28) {
  let targetX: number;
  let targetY: number;
  if ("x" in locatorOrPoint) {
    targetX = locatorOrPoint.x;
    targetY = locatorOrPoint.y;
  } else {
    const box = await locatorOrPoint.boundingBox();
    if (!box) return;
    targetX = box.x + box.width / 2;
    targetY = box.y + box.height / 2;
  }
  await page.mouse.move(targetX, targetY, { steps });
}

/** Moves smoothly to a locator and clicks it with natural human pacing. */
async function smoothClick(page: Page, locator: Locator, steps = 28) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await smoothMoveTo(page, locator, steps);
  await page.waitForTimeout(140);
  await locator.click();
}

test("record Cooky 45-second Belief Machine pitch video", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const origin = baseURL ?? "http://localhost:3000";

  // 0. Ensure fresh pristine seed data so "Chicken" is missing at start.
  const pnpmPath = "C:\\Users\\angel\\AppData\\Roaming\\npm;" + (process.env.PATH ?? "");
  execSync("pnpm tsx --tsconfig scripts/tsconfig.json scripts/seed-pitch-demo.ts", {
    cwd: process.cwd(),
    env: { ...process.env, PATH: pnpmPath },
    stdio: "inherit",
  });

  await injectPitchCursor(page);

  // =========================================================================
  // Scene 1 (0s–11s) — Weather + My Kitchen (/en/kitchen)
  // =========================================================================
  await page.goto(`${origin}/en/kitchen`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Kitchen" })).toBeVisible();

  // Move smoothly to the weather chip in the top bar.
  const weatherChip = page.locator("header button").filter({ hasText: /°/ }).first();
  await expect(weatherChip).toBeVisible();
  await smoothClick(page, weatherChip);

  // Hold weather popover open for 2.5s for viewers to see real Algiers weather context.
  await page.waitForTimeout(2500);

  // Close the weather popover.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Move to the ingredient input field.
  const pantryInput = page.locator("#pantry-add");
  await smoothClick(page, pantryInput);
  await page.waitForTimeout(300);

  // Type missing ingredient "Chicken" with realistic human cadence.
  await pantryInput.pressSequentially("Chicken", { delay: 90 });

  // Autocomplete suggestions appear: pick the suggestion.
  const chickenOption = page.getByRole("option", { name: "Chicken" }).first();
  await chickenOption.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
  if (await chickenOption.isVisible()) {
    await smoothClick(page, chickenOption);
  } else {
    await page.keyboard.press("Enter");
  }

  // Click Add button.
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await smoothClick(page, addButton);

  // Pause 3 seconds: toast pops up and "Ready to cook" panel immediately updates live!
  await page.waitForTimeout(3000);

  // =========================================================================
  // Scene 2 (11s–24s) — Cook Ranking & Cooking Mode (/en/cook -> /en/dishes/[id]/cook)
  // =========================================================================
  await page.goto(`${origin}/en/cook`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Cook" })).toBeVisible();

  // Pause 2.5s on the ranked dishes view (both Tagine and Shakshuka are ready to cook).
  await page.waitForTimeout(2500);

  // Click "Start cooking" on the top ready dish (Chicken Tagine).
  const startCookingLink = page.getByRole("link", { name: "Start cooking" }).first();
  await smoothClick(page, startCookingLink);

  // Cooking Mode opens full-screen.
  await page.waitForURL(/\/cook$/);
  await page.waitForTimeout(1500);

  // Advance from Ingredients list (screen 0) to Step 1.
  const nextStepBtn = page.getByRole("button", { name: "Next" });
  await smoothClick(page, nextStepBtn);

  // Pause 2s on the XL step text: "Rub the chicken with the spices...".
  await page.waitForTimeout(2000);

  // Start the inline step timer.
  const timerStartBtn = page.getByRole("button", { name: /Start/i });
  await smoothClick(page, timerStartBtn);

  // Let the timer tick down live for 2.2 seconds.
  await page.waitForTimeout(2200);

  // Advance to Step 2.
  await smoothClick(page, page.getByRole("button", { name: "Next" }));
  await page.waitForTimeout(1600);

  // =========================================================================
  // Scene 3 (24s–35s) — AI Assistant & Merged Shopping List (/en/assistant -> /en/shopping)
  // =========================================================================
  await page.goto(`${origin}/en/assistant`);
  await page.waitForLoadState("networkidle");

  // Click the sample thread in the sidebar to open the conversation.
  const threadLink = page.getByText("What can I cook with what's in my kitchen?").first();
  await smoothClick(page, threadLink);

  // Hold 4 seconds on the rich AI reply and real dish pick cards.
  await page.waitForTimeout(4000);

  // Navigate to /en/shopping.
  await page.goto(`${origin}/en/shopping`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Shopping list" })).toBeVisible();

  // Pause 1.5s on the 7-item aisle list.
  await page.waitForTimeout(1500);

  // Check off 2 items in the aisle list.
  const item1 = page.locator("li").filter({ hasText: "Whole chicken" }).getByRole("checkbox");
  if (await item1.isVisible()) {
    await smoothClick(page, item1);
    await page.waitForTimeout(1200);
  }

  const item2 = page.locator("li").filter({ hasText: "Fresh coriander" }).getByRole("checkbox");
  if (await item2.isVisible()) {
    await smoothClick(page, item2);
    await page.waitForTimeout(1600);
  }

  // =========================================================================
  // Scene 4 (35s–45s) — Full Arabic RTL & Dark Theme (/ar/cook)
  // =========================================================================
  // Switch to Arabic via the top bar language switcher.
  const langSwitcher = page.locator("header").getByRole("button", { name: /Language|English/i }).first();
  await smoothClick(page, langSwitcher);
  await page.waitForTimeout(400);

  const arabicMenuItem = page.getByRole("menuitemradio", { name: "العربية" }).first();
  await smoothClick(page, arabicMenuItem);

  // Wait for Arabic route to load.
  await page.waitForURL(/\/ar\//);
  await page.goto(`${origin}/ar/cook`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);

  // Toggle theme to dark mode in the top bar using the exact Arabic label.
  const themeToggle = page.locator("header").getByRole("button", { name: "تغيير المظهر" });
  await smoothClick(page, themeToggle);
  await page.waitForTimeout(400);

  const darkOption = page.getByRole("menuitemradio", { name: "داكن" });
  await smoothClick(page, darkOption);

  // Hold on the final sleek RTL Dark Mode screen for 4 seconds.
  await page.waitForTimeout(4000);

  // =========================================================================
  // Video Finalization & Export
  // =========================================================================
  const video = page.video();
  await page.close();

  if (video) {
    const rawVideoPath = await video.path();
    const destDir = path.resolve(process.cwd(), "pitch-video");
    fs.mkdirSync(destDir, { recursive: true });
    const targetWebm = path.join(destDir, "cooky-belief-machine.webm");
    fs.copyFileSync(rawVideoPath, targetWebm);
    console.log(`\n[pitch-video] Video exported to: ${targetWebm}`);

    // Check for ffmpeg and export MP4 if available
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
      const targetMp4 = path.join(destDir, "cooky-belief-machine.mp4");
      execSync(`ffmpeg -y -i "${targetWebm}" -c:v libx264 -pix_fmt yuv420p -r 60 "${targetMp4}"`, {
        stdio: "inherit",
      });
      console.log(`[pitch-video] MP4 exported to: ${targetMp4}`);
    } catch {
      console.log("[pitch-video] ffmpeg not found; .webm is ready.");
    }
  }
});
