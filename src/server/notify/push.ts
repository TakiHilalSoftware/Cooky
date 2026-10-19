import "server-only";

import { eq, inArray } from "drizzle-orm";
import { createTranslator } from "next-intl";
import webpush, { WebPushError } from "web-push";

import type { NotificationKind } from "@/lib/social";
import { getDb } from "@/server/db/client";
import { profiles, pushSubscriptions } from "@/server/db/schema";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const CATALOGS = { en, fr, ar } as const;

/** Each push template, and the preference that switches it off. */
export const PUSH_TEMPLATES = {
  message: "messages",
  friendRequest: "friend_requests",
  friendAccepted: "friend_accepted",
  trialEnding: "billing",
  paymentFailed: "billing",
  cancellationConfirmed: "billing",
  receipt: "billing",
  // Operational alerts for admins can't be switched off.
  adminFeedback: null,
} as const satisfies Record<string, NotificationKind | null>;
export type PushTemplate = keyof typeof PUSH_TEMPLATES;

/** The VAPID pair and subject are set (docs/SETUP_KEYS.md §10). */
export function pushConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

let configured = false;
function vapid() {
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT!, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
}

export type PushPayload = { title: string; body: string; url: string; tag: string };

/** The notification in one language. Message text never goes in a push: only who sent it. */
export function renderPush(
  template: PushTemplate,
  locale: keyof typeof CATALOGS,
  params: Record<string, string>,
  url: string,
): PushPayload {
  const t = createTranslator({ locale, messages: CATALOGS[locale], namespace: "push" });
  return { title: t(`${template}.title`, params), body: t(`${template}.body`, params), url, tag: template };
}

/**
 * Sends to every device the person turned push on for, in that device's
 * language, unless they switched this type off. Gone subscriptions (404/410)
 * are deleted; other failures throw so the outbox retries.
 */
export async function sendPush(
  userId: string,
  template: PushTemplate,
  params: Record<string, string>,
  url: string,
): Promise<void> {
  if (!pushConfigured()) return;
  const db = getDb();
  const [profile] = await db
    .select({ off: profiles.notificationsOff })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const kind = PUSH_TEMPLATES[template];
  if (kind && profile?.off.includes(kind)) return;

  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subscriptions.length === 0) return;
  vapid();

  const gone: string[] = [];
  let failure: unknown = null;
  for (const sub of subscriptions) {
    const payload = renderPush(template, sub.locale, params, url);
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: template === "message" ? "high" : "normal" },
      );
    } catch (err) {
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) gone.push(sub.id);
      else failure = err;
    }
  }
  if (gone.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  if (failure) {
    logger.warn({ err: failure, userId }, "push delivery failed");
    throw failure instanceof Error ? failure : new Error("push delivery failed");
  }
}
