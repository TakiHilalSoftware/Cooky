import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { auditLog, outbox, user } from "@/server/db/schema";

export const db = () => getDb();

/** Empties every table between tests (fast; keeps the migrated schema). */
export async function resetData() {
  // Listing tables (rather than dropping the schema) keeps the migrations table intact.
  await getDb().execute(
    sql.raw(
      `truncate table "user", "session", "account", "verification", "rate_limit", profiles, consents, audit_log, outbox, login_attempts, two_factor, passkey restart identity cascade`,
    ),
  );
}

export async function userByEmail(email: string) {
  const [row] = await getDb().select().from(user).where(eq(user.email, email)).limit(1);
  return row;
}

export async function latestEmailJob() {
  const [row] = await getDb().select().from(outbox).orderBy(desc(outbox.createdAt)).limit(1);
  return row as (typeof row & { payload: { template: string; url?: string; to: string } }) | undefined;
}

export async function auditActions(actorId: string) {
  const rows = await getDb().select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.actorId, actorId));
  return rows.map((r) => r.action);
}
