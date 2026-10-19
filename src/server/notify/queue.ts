import "server-only";

import type { Executor } from "@/server/db/client";
import { enqueue } from "@/server/outbox/enqueue";
import type { RealtimeEvent } from "@/server/realtime/dto";
import { realtimeConfigured } from "@/server/realtime/pusher";

import { pushConfigured, type PushTemplate } from "./push";

// Side effects go through the outbox, inside the caller's transaction
// (AGENT_RULES §3.7). Nothing is queued for a provider that isn't set up.

export async function queueRealtime(executor: Executor, userIds: string[], event: RealtimeEvent): Promise<void> {
  if (!realtimeConfigured() || userIds.length === 0) return;
  await enqueue(executor, { kind: "pusher", payload: { userIds, event } });
}

export async function queuePush(
  executor: Executor,
  userId: string,
  template: PushTemplate,
  params: Record<string, string>,
  url: string,
): Promise<void> {
  if (!pushConfigured()) return;
  await enqueue(executor, { kind: "push", payload: { template, userId, params, url } });
}
