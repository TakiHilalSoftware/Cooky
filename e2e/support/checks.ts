import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** PRD §3.10: no horizontal scroll, down to 320 px. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * WCAG 2.2 AA: no serious or critical axe violations. Scans the settled page:
 * a refresh in flight or a dialog still fading in would report contrast and
 * title problems the person never sees.
 */
export async function expectAccessible(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}
