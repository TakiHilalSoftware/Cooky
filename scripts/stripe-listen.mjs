/**
 * Forwards Stripe test-mode webhooks to the local dev server, as the account
 * STRIPE_SECRET_KEY belongs to (whatever account the CLI itself is logged into).
 *
 *   pnpm stripe:listen        (keep it running next to `pnpm dev`)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("No .env.local found.");
  process.exit(1);
}
const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_…).");
  process.exit(1);
}
/** Must match HANDLED_EVENTS in src/server/billing/webhook.ts (a unit test checks). */
const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
];

/** `stripe` on PATH, or winget's install folder (which a terminal opened before the install doesn't see yet). */
function stripeCli() {
  if (spawnSync("stripe", ["--version"], { shell: true, stdio: "ignore" }).status === 0) return "stripe";
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe/stripe.exe",
  );
  if (process.platform === "win32" && existsSync(winget)) return `"${winget}"`;
  console.error("Stripe CLI not found. Install it (https://docs.stripe.com/stripe-cli), then open a new terminal.");
  process.exit(1);
}

// The same origin the app builds its Checkout return URLs from, so webhooks and redirects reach one server.
const webhookUrl = new URL(
  "/api/webhooks/stripe",
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
).toString();
console.log(`Forwarding Stripe webhooks to ${webhookUrl}`);

const child = spawn(
  stripeCli(),
  ["listen", "--api-key", key, "--events", EVENTS.join(","), "--forward-to", webhookUrl],
  {
    stdio: "inherit",
    shell: true,
  },
);
child.on("exit", (code) => process.exit(code ?? 0));
