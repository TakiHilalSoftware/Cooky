"use server";

import { and, eq, isNull } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { calendarFeeds } from "@/server/db/schema";
import { newFeedToken } from "@/server/features/calendar-feed/service";
import { env } from "@/server/env";
import { hasFeature } from "@/server/quota/tries";

import { userAction } from "./_clients";

/**
 * Creates the private iCal link (Pro). Any earlier link stops working. The
 * URL is returned this once; only its hash is stored.
 */
export const createCalendarFeed = userAction
  .metadata({ actionName: "createCalendarFeed" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    if (!(await hasFeature(ctx.user.id, "ical_feed"))) returnServerError<ActionErrorCode>("plan_required");
    const { token, hash } = newFeedToken();
    await getDb().transaction(async (tx) => {
      await tx
        .update(calendarFeeds)
        .set({ revokedAt: new Date() })
        .where(and(eq(calendarFeeds.userId, ctx.user.id), isNull(calendarFeeds.revokedAt)));
      await tx.insert(calendarFeeds).values({ userId: ctx.user.id, tokenHash: hash });
    });
    revalidatePath("/[locale]/settings", "page");
    return { url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/calendar/${token}` };
  });

export const revokeCalendarFeed = userAction
  .metadata({ actionName: "revokeCalendarFeed" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    await getDb()
      .update(calendarFeeds)
      .set({ revokedAt: new Date() })
      .where(and(eq(calendarFeeds.userId, ctx.user.id), isNull(calendarFeeds.revokedAt)));
    revalidatePath("/[locale]/settings", "page");
    return { revoked: true };
  });
