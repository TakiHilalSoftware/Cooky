/**
 * Everything a plan can limit (PRD §3.7). The numbers live in the database
 * (`plan_limits`); this is only the vocabulary, shared with the UI.
 */
export const METERED_FEATURES = ["assistant", "voice", "import", "spins"] as const;
export const COUNTED_FEATURES = ["dishes", "collections", "upcoming_events", "friend_groups"] as const;
export const GATED_FEATURES = ["backup_import", "household_list", "ical_feed", "ai_suggest"] as const;

export const PLAN_FEATURES = [...METERED_FEATURES, ...COUNTED_FEATURES, ...GATED_FEATURES] as const;

export type MeteredFeature = (typeof METERED_FEATURES)[number];
export type CountedFeature = (typeof COUNTED_FEATURES)[number];
export type GatedFeature = (typeof GATED_FEATURES)[number];
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/** day | month: a counter per period. none: a cap (counted) or on/off (gated). */
export const LIMIT_PERIODS = ["day", "month", "none"] as const;
export type LimitPeriod = (typeof LIMIT_PERIODS)[number];

export function isMeteredFeature(feature: string): feature is MeteredFeature {
  return (METERED_FEATURES as readonly string[]).includes(feature);
}
