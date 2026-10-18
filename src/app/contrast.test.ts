import { readFileSync } from "node:fs";

import { wcagContrast } from "culori";
import { describe, expect, it } from "vitest";

/**
 * PRD §3.10 / AGENT_RULES §5: AA contrast in every palette and theme.
 * Reads the real tokens from globals.css, so a color tweak that breaks
 * contrast fails here before it reaches anyone's screen.
 */
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

const ACCENTS = ["default", "peach", "mint", "sky", "lavender", "sand", "rose"] as const;
const THEMES = ["light", "dark"] as const;

type Tokens = Record<string, string>;

function block(selector: string): Tokens {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) return {};
  const tokens: Tokens = {};
  for (const [, name, value] of match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

function tokensFor(theme: (typeof THEMES)[number], accent: (typeof ACCENTS)[number]): Tokens {
  const merged: Tokens = { ...block(":root") };
  if (theme === "dark") Object.assign(merged, block(".dark"));
  if (accent !== "default") {
    Object.assign(merged, block(`html[data-accent="${accent}"]`));
    if (theme === "dark") Object.assign(merged, block(`html.dark[data-accent="${accent}"]`));
  }
  return merged;
}

function resolve(tokens: Tokens, name: string, depth = 0): string {
  const value = tokens[name];
  if (!value) throw new Error(`--${name} is not defined`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  if (ref?.[1] && depth < 5) return resolve(tokens, ref[1], depth + 1);
  return value;
}

/** [foreground, background, minimum ratio, why] */
const PAIRS: [string, string, number, string][] = [
  ["foreground", "background", 4.5, "body text"],
  ["muted-foreground", "background", 4.5, "secondary text"],
  ["muted-foreground", "muted", 4.5, "secondary text on muted panels"],
  ["card-foreground", "card", 4.5, "text on cards"],
  ["popover-foreground", "popover", 4.5, "menus and tooltips"],
  ["primary-foreground", "primary", 4.5, "primary button label"],
  ["secondary-foreground", "secondary", 4.5, "secondary button label"],
  ["accent-foreground", "accent", 4.5, "hovered menu item"],
  ["primary-strong", "background", 4.5, "links and accent text"],
  ["destructive", "background", 4.5, "destructive text"],
  ["ring", "background", 3, "focus ring (WCAG 1.4.11)"],
  ["input", "background", 3, "form field border (WCAG 1.4.11)"],
];

describe("color tokens", () => {
  it("define an override for every accent in both themes", () => {
    for (const accent of ACCENTS.filter((a) => a !== "default")) {
      expect(block(`html[data-accent="${accent}"]`).primary, accent).toBeDefined();
      expect(block(`html.dark[data-accent="${accent}"]`).primary, accent).toBeDefined();
    }
  });

  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      it(`meet WCAG AA in ${theme} / ${accent}`, () => {
        const tokens = tokensFor(theme, accent);
        const failures = PAIRS.flatMap(([fg, bg, min, why]) => {
          const ratio = wcagContrast(resolve(tokens, fg), resolve(tokens, bg));
          return ratio >= min ? [] : [`${fg} on ${bg} (${why}): ${ratio.toFixed(2)} < ${min}`];
        });
        expect(failures).toEqual([]);
      });
    }
  }
});
