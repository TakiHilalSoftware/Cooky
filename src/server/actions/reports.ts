"use server";

import { and, eq, ne } from "drizzle-orm";
import { returnServerError } from "next-safe-action";

import type { ActionErrorCode } from "@/lib/errors";
import type { ReportTarget } from "@/lib/social";
import { getDb } from "@/server/db/client";
import { dishRatings, messages, reports, user } from "@/server/db/schema";
import { findOwnConversation } from "@/server/features/messages/queries";
import { findViewableDish } from "@/server/features/social/policy";
import { reportSchema } from "@/server/features/social/schema";

import { userAction } from "./_clients";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only what the reporter can actually see, and never their own content. */
async function canReport(reporterId: string, type: ReportTarget, id: string): Promise<boolean> {
  const db = getDb();
  if (type === "user") {
    if (id === reporterId) return false;
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, id)).limit(1);
    return Boolean(row);
  }
  if (!UUID.test(id)) return false;
  if (type === "dish") {
    const found = await findViewableDish(reporterId, id);
    return Boolean(found && !found.isOwner);
  }
  if (type === "message") {
    const [message] = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(and(eq(messages.id, id), ne(messages.senderId, reporterId)))
      .limit(1);
    return Boolean(message && (await findOwnConversation(reporterId, message.conversationId)));
  }
  const [rating] = await db
    .select({ dishId: dishRatings.dishId })
    .from(dishRatings)
    .where(and(eq(dishRatings.id, id), ne(dishRatings.userId, reporterId)))
    .limit(1);
  return Boolean(rating && (await findViewableDish(reporterId, rating.dishId)));
}

/**
 * Report a person, dish, review or message (PRD §3.6) for the admin queue.
 * Reporting the same thing twice while it's open adds nothing.
 */
export const reportContent = userAction
  .metadata({ actionName: "reportContent" })
  .inputSchema(reportSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    if (!(await canReport(ctx.user.id, input.targetType, input.targetId))) {
      returnServerError<ActionErrorCode>("not_found");
    }
    await getDb()
      .insert(reports)
      .values({
        reporterId: ctx.user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details || null,
      })
      .onConflictDoNothing();
    return { reported: true };
  });
