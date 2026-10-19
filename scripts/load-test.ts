/**
 * A small load test against a deployment (ROADMAP Phase 8, release gate
 * "Performance": p95 TTFB < 800 ms). It requests each page with N parallel
 * clients for a while and reports p50 / p95 time to first byte.
 *
 *   pnpm load:test https://preview.cooky.example
 *   LOAD_COOKIE="cooky.session_token=…" pnpm load:test https://… --signed-in
 *   pnpm load:test https://… --concurrency 20 --seconds 30
 *
 * Exits non-zero when any page's p95 is over the budget. Run it against a
 * preview with production data volumes, not against localhost dev.
 */
export {};

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/$/, "");
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const concurrency = flag("concurrency", 10);
const seconds = flag("seconds", 20);
const signedIn = args.includes("--signed-in");
const BUDGET_MS = 800;

if (!base) {
  console.error("Usage: pnpm load:test <base url> [--signed-in] [--concurrency 10] [--seconds 20]");
  process.exit(1);
}
const cookie = process.env.LOAD_COOKIE;
if (signedIn && !cookie) {
  console.error("--signed-in needs LOAD_COOKIE (copy the session cookie from a test account's browser).");
  process.exit(1);
}

const PUBLIC = ["/en", "/fr/pricing", "/ar/discover", "/en/privacy"];
const SIGNED_IN = ["/en/dishes", "/en/cook", "/en/planner", "/en/shopping", "/en/friends", "/en/messages"];
const pages = signedIn ? SIGNED_IN : PUBLIC;

/** Time until the response headers arrive (TTFB), in ms. */
async function ttfb(url: string): Promise<number | null> {
  const started = performance.now();
  try {
    const response = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    const elapsed = performance.now() - started;
    await response.arrayBuffer();
    return response.status < 400 ? elapsed : null;
  } catch {
    return null;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

let failed = false;
console.log(`Load test: ${base} · ${concurrency} clients · ${seconds}s per page · budget p95 < ${BUDGET_MS} ms\n`);
for (const page of pages) {
  const url = `${base}${page}`;
  const until = Date.now() + seconds * 1000;
  const samples: number[] = [];
  let errors = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (Date.now() < until) {
        const ms = await ttfb(url);
        if (ms === null) errors++;
        else samples.push(ms);
      }
    }),
  );
  samples.sort((a, b) => a - b);
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const ok = p95 < BUDGET_MS && errors === 0;
  if (!ok) failed = true;
  console.log(
    `${ok ? "✓" : "✗"} ${page.padEnd(16)} requests ${String(samples.length).padStart(5)}  errors ${String(errors).padStart(3)}  p50 ${p50.toFixed(0).padStart(5)} ms  p95 ${p95.toFixed(0).padStart(5)} ms`,
  );
}
process.exit(failed ? 1 : 0);
