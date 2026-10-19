"use server";

import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { auth } from "@/server/auth/auth";
import { authErrorCode } from "@/server/auth/errors";
import { authRequestHeaders } from "@/server/auth/request-headers";
import { getDb } from "@/server/db/client";
import { account, dataExports, feedback, profiles, session, user } from "@/server/db/schema";
import { env } from "@/server/env";
import { scheduleDeletion } from "@/server/features/account/deletion";
import { sendFeedbackSchema } from "@/server/features/admin/schema";
import { queuePush } from "@/server/notify/queue";
import { enqueue, drainSoon } from "@/server/outbox/enqueue";

import { userAction } from "./_clients";

const HOUR_MS = 60 * 60 * 1000;
/** Social-only accounts have no password to re-check: they confirm with a fresh login instead. */
const FRESH_LOGIN_MS = 15 * 60 * 1000;
const FEEDBACK_PER_HOUR = 5;

/** A full copy of the person's data (PRD §3.1), prepared in the background; one at a time, once an hour. */
export const requestDataExport = userAction
  .metadata({ actionName: "requestDataExport" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const created = await getDb().transaction(async (tx) => {
      const [recent] = await tx
        .select({ id: dataExports.id, status: dataExports.status })
        .from(dataExports)
        .where(
          and(
            eq(dataExports.userId, ctx.user.id),
            gt(dataExports.createdAt, new Date(Date.now() - HOUR_MS)),
            inArray(dataExports.status, ["queued", "running", "ready"]),
          ),
        )
        .orderBy(desc(dataExports.createdAt))
        .limit(1);
      if (recent) returnServerError<ActionErrorCode>("rate_limited");
      const [row] = await tx.insert(dataExports).values({ userId: ctx.user.id }).returning({ id: dataExports.id });
      await enqueue(tx, { kind: "data_export", payload: { exportId: row!.id } });
      await audit(tx, { actorId: ctx.user.id, action: "account.export_requested", targetId: row!.id, ip: ctx.ip });
      return row!;
    });
    drainSoon();
    revalidatePath("/[locale]/settings/data", "page");
    return { id: created.id };
  });

/**
 * Deletes the account after a 7-day grace (PRD §3.1). Needs the password (or
 * a login from the last 15 minutes for Google/Apple accounts). The
 * subscription is cancelled first; logging in within the grace cancels it.
 */
export const requestAccountDeletion = userAction
  .metadata({ actionName: "requestAccountDeletion" })
  .inputSchema(z.object({ password: z.string().max(128).optional() }))
  .action(async ({ parsedInput: { password }, ctx }) => {
    const db = getDb();
    const [credential] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, "credential")))
      .limit(1);
    if (credential) {
      if (!password) return { status: "password_required" as const };
      try {
        await auth.api.verifyPassword({ body: { password }, headers: await authRequestHeaders() });
      } catch (error) {
        if (authErrorCode(error) === "INVALID_PASSWORD") return { status: "wrong_password" as const };
        throw error;
      }
    } else {
      const [current] = await db
        .select({ createdAt: session.createdAt })
        .from(session)
        .where(eq(session.id, ctx.sessionId))
        .limit(1);
      if (!current || Date.now() - current.createdAt.getTime() > FRESH_LOGIN_MS) {
        return { status: "login_again" as const };
      }
    }
    await db.transaction(async (tx) => {
      await enqueue(tx, { kind: "stripe_cancel", payload: { userId: ctx.user.id } });
      await enqueue(tx, {
        kind: "email",
        // Logging in within the grace cancels the deletion, so the email links there.
        payload: {
          template: "accountDeletionScheduled",
          userId: ctx.user.id,
          to: ctx.user.email,
          url: `${env.NEXT_PUBLIC_APP_URL}/login`,
        },
      });
      await audit(tx, { actorId: ctx.user.id, action: "account.deletion_requested", ip: ctx.ip });
      await scheduleDeletion(tx, ctx.user.id);
    });
    drainSoon();
    return { status: "scheduled" as const };
  });

/**
 * Help & feedback (PRD §3.8): bug, idea or other, 5 an hour, with language
 * and browser attached for whoever reads it. Admins get a push alert.
 */
export const sendFeedback = userAction
  .metadata({ actionName: "sendFeedback" })
  .inputSchema(sendFeedbackSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const requestHeaders = await headers();
    await getDb().transaction(async (tx) => {
      const recent = await tx
        .select({ id: feedback.id })
        .from(feedback)
        .where(and(eq(feedback.userId, ctx.user.id), gt(feedback.createdAt, new Date(Date.now() - HOUR_MS))))
        .limit(FEEDBACK_PER_HOUR);
      if (recent.length >= FEEDBACK_PER_HOUR) returnServerError<ActionErrorCode>("rate_limited");
      const [profile] = await tx
        .select({ locale: profiles.locale })
        .from(profiles)
        .where(eq(profiles.userId, ctx.user.id))
        .limit(1);
      await tx.insert(feedback).values({
        userId: ctx.user.id,
        kind: input.kind,
        message: input.message,
        locale: profile?.locale ?? "en",
        userAgent: requestHeaders.get("user-agent")?.slice(0, 300) ?? null,
      });
      const admins = await tx.select({ id: user.id }).from(user).where(eq(user.role, "admin"));
      for (const admin of admins) {
        await queuePush(tx, admin.id, "adminFeedback", { kind: input.kind }, "/admin/feedback");
      }
    });
    drainSoon();
    return { sent: true };
  });
