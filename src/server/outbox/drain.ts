import "server-only";

import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { outbox } from "@/server/db/schema";
import { logger } from "@/server/observability/logger";

import { PermanentJobError } from "./errors";
import { handleJob } from "./handlers";
import { outboxJobSchema } from "./jobs";

export const MAX_ATTEMPTS = 8;
/** A claimed job is hidden from other drains for this long, then retried. */
const LEASE = sql`interval '5 minutes'`;

/** Exponential backoff in minutes: 1, 2, 4 … capped at an hour. */
export function backoffMinutes(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 60);
}

export type DrainResult = { done: number; retried: number; dead: number };

/**
 * Claims due jobs (SKIP LOCKED, so parallel drains never double-send), runs
 * them and records the outcome. Jobs that keep failing go to `dead` and are
 * reported, never silently dropped.
 */
export async function drainOutbox({ limit }: { limit: number }): Promise<DrainResult> {
  const db = getDb();
  const due = db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(eq(outbox.status, "pending"), lte(outbox.runAfter, sql`now()`)))
    .orderBy(asc(outbox.runAfter))
    .limit(limit)
    .for("update", { skipLocked: true });

  const claimed = await db
    .update(outbox)
    .set({ attempts: sql`${outbox.attempts} + 1`, runAfter: sql`now() + ${LEASE}` })
    .where(inArray(outbox.id, due))
    .returning();

  const result: DrainResult = { done: 0, retried: 0, dead: 0 };
  for (const row of claimed) {
    try {
      const job = outboxJobSchema.parse({ kind: row.kind, payload: row.payload });
      await handleJob(job);
      // Drop an email's single-use link from the stored payload once it has been delivered.
      const kept = job.kind === "email" ? { ...job.payload, url: undefined } : job.payload;
      await db.update(outbox).set({ status: "done", payload: kept, lastError: null }).where(eq(outbox.id, row.id));
      result.done++;
    } catch (err) {
      // A permanent failure (bad sender, bad key) won't fix itself: stop now.
      const dead = err instanceof PermanentJobError || row.attempts >= MAX_ATTEMPTS;
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(outbox)
        .set({
          status: dead ? "dead" : "pending",
          lastError: message.slice(0, 500),
          runAfter: sql`now() + make_interval(mins => ${backoffMinutes(row.attempts)})`,
        })
        .where(eq(outbox.id, row.id));
      if (dead) {
        result.dead++;
        logger.error({ err, outboxId: row.id, kind: row.kind }, "outbox job dead-lettered");
        // The dead-letter alert (PRD §4): someone has to look at it.
        Sentry.captureMessage("Outbox job dead-lettered", {
          level: "error",
          tags: { outboxKind: row.kind },
          extra: { outboxId: row.id, attempts: row.attempts },
        });
      } else {
        result.retried++;
        logger.warn({ err, outboxId: row.id, attempts: row.attempts }, "outbox job failed; will retry");
      }
    }
  }
  return result;
}
