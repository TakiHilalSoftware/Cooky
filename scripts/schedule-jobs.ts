/**
 * Registers Cooky's QStash schedules against an app URL (docs/SETUP_KEYS.md §6).
 * Safe to run again: each schedule has a fixed id, so it's overwritten in place.
 *
 *   pnpm jobs:schedule                         # uses NEXT_PUBLIC_APP_URL
 *   pnpm jobs:schedule https://cooky.example   # or an explicit URL
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

export {};

const { Client } = await import("@upstash/qstash");

const token = process.env.QSTASH_TOKEN;
const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
if (!token || !/^https:\/\//.test(base)) {
  console.error("Needs QSTASH_TOKEN and an https app URL (argument or NEXT_PUBLIC_APP_URL).");
  process.exit(1);
}

/** ARCHITECTURE §5.12: the drain every minute, maintenance on its own rhythm (UTC). */
const SCHEDULES = [
  { id: "cooky-outbox-drain", path: "/api/jobs/drain", cron: "* * * * *" },
  { id: "cooky-release-reservations", path: "/api/cron/release-reservations", cron: "*/5 * * * *" },
  { id: "cooky-cleanup", path: "/api/cron/cleanup", cron: "17 * * * *" },
  { id: "cooky-purge-deleted", path: "/api/cron/purge-deleted", cron: "30 3 * * *" },
  { id: "cooky-purge-accounts", path: "/api/cron/purge-accounts", cron: "45 3 * * *" },
  { id: "cooky-billing-reconcile", path: "/api/cron/billing-reconcile", cron: "0 4 * * *" },
] as const;

const client = new Client({ token });
for (const s of SCHEDULES) {
  await client.schedules.create({ scheduleId: s.id, destination: `${base}${s.path}`, cron: s.cron, method: "POST" });
  console.log(`✓ ${s.id.padEnd(28)} ${s.cron.padEnd(12)} → ${base}${s.path}`);
}
console.log(`\n${SCHEDULES.length} schedules registered.`);
