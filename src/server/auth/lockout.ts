import "server-only";

import { createHmac } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { loginAttempts } from "@/server/db/schema";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

import { FORGET_AFTER_MS, lockSecondsAfter } from "./lockout-policy";

function emailKey(email: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET ?? "cooky-dev")
    .update(`login:${email.trim().toLowerCase()}`)
    .digest("hex");
}

/** When the email's lock ends, or null if it can try now. */
export async function lockedUntil(email: string, now = new Date()): Promise<Date | null> {
  const [row] = await getDb()
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(eq(loginAttempts.emailKey, emailKey(email)))
    .limit(1);
  return row?.lockedUntil && row.lockedUntil > now ? row.lockedUntil : null;
}

/**
 * Counts a wrong password (one atomic upsert, so parallel attempts all count)
 * and starts a lock when a threshold is reached.
 */
export async function recordFailedLogin(email: string, now = new Date()): Promise<void> {
  const key = emailKey(email);
  const forgetBefore = new Date(now.getTime() - FORGET_AFTER_MS);
  const [row] = await getDb()
    .insert(loginAttempts)
    .values({ emailKey: key, failures: 1, lastFailureAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.emailKey,
      set: {
        failures: sql`case when ${loginAttempts.lastFailureAt} > ${forgetBefore} then ${loginAttempts.failures} + 1 else 1 end`,
        lastFailureAt: now,
      },
    })
    .returning({ failures: loginAttempts.failures });
  const seconds = lockSecondsAfter(row?.failures ?? 1);
  if (seconds === 0) return;
  await getDb()
    .update(loginAttempts)
    .set({ lockedUntil: new Date(now.getTime() + seconds * 1000) })
    .where(eq(loginAttempts.emailKey, key));
  logger.warn({ failures: row?.failures, seconds }, "login locked after repeated failures");
}

/** A correct password (or a password reset) wipes the slate. */
export async function clearFailedLogins(email: string): Promise<void> {
  await getDb()
    .delete(loginAttempts)
    .where(eq(loginAttempts.emailKey, emailKey(email)));
}
