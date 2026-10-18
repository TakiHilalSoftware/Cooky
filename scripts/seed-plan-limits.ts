/**
 * The single source of tier limits (PRD §3.7, a proposal to validate).
 * Upserts every plan × feature row, so re-running it applies changes.
 *
 *   pnpm db:seed
 *
 * limit: a number = the cap, null = unlimited, 0 = not on this plan.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

// A module, so top-level await works; imports are dynamic so .env.local loads first.
export {};

type Row = { limit: number | null; period: "day" | "month" | "none" };
type Table = Record<"free" | "plus" | "pro", Record<string, Row>>;

const month = (limit: number | null): Row => ({ limit, period: "month" });
const day = (limit: number | null): Row => ({ limit, period: "day" });
const cap = (limit: number | null): Row => ({ limit, period: "none" });
const ON = cap(null);
const OFF = cap(0);

export const LIMITS: Table = {
  free: {
    assistant: month(10),
    voice: month(10),
    import: month(5),
    spins: day(3),
    dishes: cap(50),
    collections: cap(3),
    upcoming_events: cap(2),
    friend_groups: cap(2),
    backup_import: OFF,
    household_list: OFF,
    ical_feed: OFF,
    // Free gets the rule-based Suggest only (PRD §3.5).
    ai_suggest: OFF,
  },
  plus: {
    assistant: month(150),
    voice: month(100),
    import: month(50),
    spins: day(20),
    dishes: cap(500),
    collections: cap(null),
    upcoming_events: cap(null),
    friend_groups: cap(10),
    backup_import: ON,
    household_list: OFF,
    ical_feed: OFF,
    ai_suggest: ON,
  },
  pro: {
    assistant: month(600),
    voice: month(400),
    import: month(200),
    spins: day(null),
    dishes: cap(2000),
    collections: cap(null),
    upcoming_events: cap(null),
    friend_groups: cap(50),
    backup_import: ON,
    household_list: ON,
    ical_feed: ON,
    ai_suggest: ON,
  },
};

if (process.argv[1]?.includes("seed-plan-limits")) {
  const { sql } = await import("drizzle-orm");
  const { PLAN_FEATURES } = await import("../src/lib/plan-features");
  const { getDb } = await import("../src/server/db/client");
  const { planLimits } = await import("../src/server/db/schema");

  const rows = (Object.keys(LIMITS) as (keyof Table)[]).flatMap((plan) =>
    PLAN_FEATURES.map((feature) => {
      const row = LIMITS[plan][feature];
      if (!row) throw new Error(`Missing limit for ${plan}.${feature}`);
      return { plan, feature, ...row };
    }),
  );
  await getDb()
    .insert(planLimits)
    .values(rows)
    .onConflictDoUpdate({
      target: [planLimits.plan, planLimits.feature],
      set: { limit: sql`excluded.limit`, period: sql`excluded.period`, updatedAt: new Date() },
    });
  console.log(`Seeded ${rows.length} plan limits.`);
  process.exit(0);
}
