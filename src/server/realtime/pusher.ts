import "server-only";

import Pusher from "pusher";

import { REALTIME_EVENT_NAME } from "@/lib/social";
import { env } from "@/server/env";

import type { RealtimeConfigDto, RealtimeEvent } from "./dto";

let client: Pusher | undefined;

/** All four Pusher variables are set (docs/SETUP_KEYS.md §9). */
export function realtimeConfigured(): boolean {
  return Boolean(
    env.PUSHER_APP_ID && env.PUSHER_SECRET && env.NEXT_PUBLIC_PUSHER_KEY && env.NEXT_PUBLIC_PUSHER_CLUSTER,
  );
}

function pusher(): Pusher {
  if (!realtimeConfigured()) throw new Error("Pusher is not configured");
  client ??= new Pusher({
    appId: env.PUSHER_APP_ID!,
    key: env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: env.PUSHER_SECRET!,
    cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });
  return client;
}

/** Each person listens on one private channel; only they can subscribe to it. */
export function userChannel(userId: string): string {
  return `private-user-${userId}`;
}

export function realtimeConfigFor(userId: string): RealtimeConfigDto {
  if (!realtimeConfigured()) return null;
  return { key: env.NEXT_PUBLIC_PUSHER_KEY!, cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER!, channel: userChannel(userId) };
}

/** Signs a subscription to the caller's own channel, or null for anyone else's. */
export function authorizeUserChannel(userId: string, socketId: string, channelName: string) {
  if (!realtimeConfigured() || channelName !== userChannel(userId)) return null;
  return pusher().authorizeChannel(socketId, channelName);
}

/** Sends an ids-only event to each person's private channel. Called by the outbox. */
export async function sendRealtime(userIds: string[], event: RealtimeEvent): Promise<void> {
  if (!realtimeConfigured() || userIds.length === 0) return;
  // Pusher accepts up to 100 channels per trigger.
  const channels = userIds.map(userChannel);
  for (let i = 0; i < channels.length; i += 100) {
    await pusher().trigger(channels.slice(i, i + 100), REALTIME_EVENT_NAME, event);
  }
}
