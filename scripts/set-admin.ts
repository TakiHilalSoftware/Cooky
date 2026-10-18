/**
 * Grants or revokes the admin role (PRD §3.8: granted by CLI or by another
 * admin). Every change is written to the audit log.
 *
 *   pnpm admin:set you@example.com
 *   pnpm admin:set you@example.com --revoke
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

// A module, so top-level await works. Imports below are dynamic on purpose:
// .env.local must be loaded before the env schema evaluates.
export {};

const [rawEmail, flag] = process.argv.slice(2);
if (!rawEmail || (flag !== undefined && flag !== "--revoke")) {
  console.error("Usage: pnpm admin:set <email> [--revoke]");
  process.exit(1);
}
const email = rawEmail.trim().toLowerCase();
const revoke = flag === "--revoke";

const { eq } = await import("drizzle-orm");
const { getDb } = await import("../src/server/db/client");
const { user } = await import("../src/server/db/schema");
const { audit } = await import("../src/server/audit/audit");

const db = getDb();
const [target] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, email)).limit(1);
if (!target) {
  console.error(`No account uses ${email}. Sign up first, then run this again.`);
  process.exit(1);
}

const role = revoke ? "user" : "admin";
if ((target.role ?? "user") === role) {
  console.log(`${email} is already ${revoke ? "not an admin" : "an admin"}. Nothing changed.`);
  process.exit(0);
}

await db.transaction(async (tx) => {
  await tx.update(user).set({ role }).where(eq(user.id, target.id));
  await audit(tx, {
    actorId: null,
    action: revoke ? "admin.role_revoked" : "admin.role_granted",
    targetType: "user",
    targetId: target.id,
    meta: { via: "cli" },
  });
});
console.log(revoke ? `${email} is no longer an admin.` : `${email} is now an admin.`);
process.exit(0);
