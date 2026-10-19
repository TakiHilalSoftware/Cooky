import "server-only";

import { and, eq, isNotNull, lt, or } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dataExports, outbox, session, verification } from "@/server/db/schema";
import { logger } from "@/server/observability/logger";
import { deleteObjects, storageConfigured } from "@/server/storage/r2";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Delivered outbox jobs are kept this long for debugging, then removed (dead ones stay until handled). */
const DONE_JOBS_TTL_MS = 30 * DAY_MS;

/**
 * Daily housekeeping (ARCHITECTURE §5.12): expired sessions and verification
 * tokens, data exports past their link (file and row), and old delivered jobs.
 */
export async function cleanupExpired(now = new Date()) {
  const db = getDb();
  const [sessions, tokens, jobs] = await Promise.all([
    db.delete(session).where(lt(session.expiresAt, now)).returning({ id: session.id }),
    db.delete(verification).where(lt(verification.expiresAt, now)).returning({ id: verification.id }),
    db
      .delete(outbox)
      .where(and(eq(outbox.status, "done"), lt(outbox.updatedAt, new Date(now.getTime() - DONE_JOBS_TTL_MS))))
      .returning({ id: outbox.id }),
  ]);

  // An export's file goes once its link expires; failed ones a day after they failed.
  const exports = await db
    .select({ id: dataExports.id, objectKey: dataExports.objectKey })
    .from(dataExports)
    .where(
      or(
        and(isNotNull(dataExports.expiresAt), lt(dataExports.expiresAt, now)),
        and(eq(dataExports.status, "failed"), lt(dataExports.updatedAt, new Date(now.getTime() - DAY_MS))),
      ),
    );
  const keys = exports.flatMap((e) => (e.objectKey ? [e.objectKey] : []));
  if (keys.length > 0 && storageConfigured()) {
    try {
      await deleteObjects(keys);
    } catch (err) {
      // Left for tomorrow: the rows stay until their files are gone.
      logger.warn({ err, count: keys.length }, "expired export files couldn't be deleted");
      return { sessions: sessions.length, tokens: tokens.length, jobs: jobs.length, exports: 0 };
    }
  }
  for (const e of exports) await db.delete(dataExports).where(eq(dataExports.id, e.id));
  return { sessions: sessions.length, tokens: tokens.length, jobs: jobs.length, exports: exports.length };
}
