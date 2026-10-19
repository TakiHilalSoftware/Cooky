"use server";

import { and, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import type { ActionErrorCode } from "@/lib/errors";
import { NOTIFICATION_KINDS } from "@/lib/social";
import { getDb } from "@/server/db/client";
import { profiles, pushSubscriptions } from "@/server/db/schema";
import { pushConfigured } from "@/server/notify/push";
import { authorizeUserChannel } from "@/server/realtime/pusher";

import { userAction, userReadAction } from "./_clients";

/**
 * Signs the browser's subscription to its own private channel (pusher-js
 * calls this instead of an auth endpoint). Any other channel is refused.
 */
export const authorizeRealtime = userReadAction
  .metadata({ actionName: "authorizeRealtime" })
  .inputSchema(
    z.object({
      socketId: z.string().regex(/^\d+\.\d+$/),
      channelName: z.string().min(1).max(200),
    }),
  )
  .action(async ({ parsedInput: { socketId, channelName }, ctx }) => {
    const auth = authorizeUserChannel(ctx.user.id, socketId, channelName);
    if (!auth) returnServerError<ActionErrorCode>("forbidden");
    return { auth: auth.auth };
  });

/** Push on this device: tied to this session, so revoking the device removes it. */
export const savePushSubscription = userAction
  .metadata({ actionName: "savePushSubscription" })
  .inputSchema(
    z.object({
      // Push services are https origins (FCM, Mozilla, Apple).
      endpoint: z.url().startsWith("https://").max(1000),
      p256dh: z.string().min(1).max(200),
      auth: z.string().min(1).max(100),
      locale: z.enum(routing.locales),
    }),
  )
  .action(async ({ parsedInput: input, ctx }) => {
    if (!pushConfigured()) returnServerError<ActionErrorCode>("unavailable");
    const values = { ...input, userId: ctx.user.id, sessionId: ctx.sessionId };
    // An endpoint belongs to one browser; whoever signs in on it now owns it.
    await getDb()
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
    revalidatePath("/[locale]/settings/notifications", "page");
    return { enabled: true };
  });

export const removePushSubscription = userAction
  .metadata({ actionName: "removePushSubscription" })
  .inputSchema(z.object({ endpoint: z.url().max(1000) }))
  .action(async ({ parsedInput: { endpoint }, ctx }) => {
    await getDb()
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, ctx.user.id)));
    revalidatePath("/[locale]/settings/notifications", "page");
    return { enabled: false };
  });

/** Which notification types are switched off (PRD §3.6). */
export const setNotificationPrefs = userAction
  .metadata({ actionName: "setNotificationPrefs" })
  .inputSchema(
    z.object({
      off: z
        .array(z.enum(NOTIFICATION_KINDS))
        .max(NOTIFICATION_KINDS.length)
        .transform((kinds) => [...new Set(kinds)]),
    }),
  )
  .action(async ({ parsedInput: { off }, ctx }) => {
    await getDb().update(profiles).set({ notificationsOff: off }).where(eq(profiles.userId, ctx.user.id));
    revalidatePath("/[locale]/settings/notifications", "page");
    return { off };
  });
