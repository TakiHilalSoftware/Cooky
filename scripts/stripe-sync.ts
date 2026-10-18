/**
 * Makes Stripe match config/plans.ts: one product per paid plan and one EUR
 * price per interval, found by lookup key (no price ids in env or code).
 * Safe to run again: matching prices are left alone; a changed amount gets a
 * new price that takes over the lookup key, and the old one is archived, so
 * existing subscribers keep their price until they change plans.
 *
 *   pnpm stripe:sync            # test mode by default
 *   pnpm stripe:sync --live     # required for an sk_live_ key
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

export {};

const { default: Stripe } = await import("stripe");
const { INTERVALS, PAID_PLANS, PLAN_PRICES, stripeLookupKey } = await import("../config/plans");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is missing. Add it to .env.local first (docs/SETUP_KEYS.md §4).");
  process.exit(1);
}
if (/^(sk|rk)_live_/.test(key) && !process.argv.includes("--live")) {
  console.error("This is a live key. Run `pnpm stripe:sync --live` if you really mean to change live prices.");
  process.exit(1);
}

const stripe = new Stripe(key, { appInfo: { name: "Cooky" } });
const NAMES = { plus: "Cooky Plus", pro: "Cooky Pro" } as const;

for (const plan of PAID_PLANS) {
  // list, not search: search lags behind writes, so a quick rerun would duplicate products.
  let product: Awaited<ReturnType<typeof stripe.products.list>>["data"][number] | undefined;
  for await (const candidate of stripe.products.list({ active: true, limit: 100 })) {
    if (candidate.metadata.cooky_plan === plan) product = candidate;
  }
  product ??= await stripe.products.create({ name: NAMES[plan], metadata: { cooky_plan: plan } });
  if (product.name !== NAMES[plan]) await stripe.products.update(product.id, { name: NAMES[plan] });

  for (const interval of INTERVALS) {
    const lookupKey = stripeLookupKey(plan, interval);
    const amount = PLAN_PRICES[plan][interval];
    const [current] = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true })).data;
    const matches =
      current &&
      current.unit_amount === amount &&
      current.currency === "eur" &&
      current.recurring?.interval === interval &&
      (typeof current.product === "string" ? current.product : current.product.id) === product.id;
    if (matches) {
      console.log(`✓ ${lookupKey} is up to date (${(amount / 100).toFixed(2)} €)`);
      continue;
    }
    await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: amount,
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      tax_behavior: "inclusive",
      metadata: { cooky_plan: plan, cooky_interval: interval },
    });
    if (current) await stripe.prices.update(current.id, { active: false });
    console.log(`${current ? "↻ replaced" : "+ created"} ${lookupKey} at ${(amount / 100).toFixed(2)} €`);
  }
}
console.log("Stripe prices match config/plans.ts.");
