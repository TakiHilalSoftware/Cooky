import "server-only";

import { createHmac } from "node:crypto";

import type { Executor } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { env } from "@/server/env";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

/** IPs are stored as a keyed hash: enough to spot abuse patterns, useless if leaked. */
export function hashIp(ip: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET ?? "cooky-dev")
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

/** Writes an audit row. Pass the open transaction so it commits with the change. */
export async function audit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    meta: entry.meta,
    ipHash: entry.ip ? hashIp(entry.ip) : null,
  });
}
