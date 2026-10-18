/**
 * Appearance choices (PRD §3.1 Settings → Appearance). One list for the
 * database enums, the input schemas, the settings UI and the contrast test.
 */
export const ACCENTS = ["default", "peach", "mint", "sky", "lavender", "sand", "rose"] as const;
export const THEMES = ["system", "light", "dark"] as const;
export const TEXT_SIZES = ["s", "m", "l", "xl"] as const;

export type Accent = (typeof ACCENTS)[number];
export type ThemePreference = (typeof THEMES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];

export type Appearance = { accent: Accent; theme: ThemePreference; textSize: TextSize };

/** What signed-out visitors (and new accounts) see. */
export const DEFAULT_APPEARANCE: Appearance = { accent: "default", theme: "system", textSize: "m" };
