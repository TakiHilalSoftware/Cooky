import "server-only";

import { after } from "next/server";

import type { Executor } from "@/server/db/client";
import { outbox } from "@/server/db/schema";
import { logger } from "@/server/observability/logger";

import type { OutboxJob } from "./jobs";

/**
 * Records a side effect next to the data change that caused it. Pass the open
 * transaction so the job commits (or rolls back) with that change.
 */
export async function enqueue(executor: Executor, job: OutboxJob): Promise<void> {
  await executor.insert(outbox).values({ kind: job.kind, payload: job.payload });
}

/**
 * Drains right after the response is sent, so emails arrive in seconds rather
 * than at the next scheduled drain. Delivery stays durable either way: if this
 * run fails, QStash's schedule picks the job up (ARCHITECTURE §5.12).
 */
export function drainSoon(): void {
  try {
    after(async () => {
      const { drainOutbox } = await import("./drain");
      await drainOutbox({ limit: 10 });
    });
  } catch (err) {
    // Outside a request (scripts, tests): the scheduled drain delivers it.
    logger.debug({ err }, "drainSoon skipped: no request scope");
  }
}
