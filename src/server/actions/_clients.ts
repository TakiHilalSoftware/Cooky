import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createSafeActionClient, returnServerError } from "next-safe-action";
import { headers } from "next/headers";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { clientIp } from "@/server/auth/request-info";
import { getSession } from "@/server/auth/session";
import { logger } from "@/server/observability/logger";
import { withinBurstLimit, type BurstRule } from "@/server/quota/burst";

/**
 * Turns an unexpected failure into the generic `unavailable` code. The real
 * error (message, stack, provider response) goes to logs and Sentry only, so
 * nothing internal ever reaches the browser. Expected failures are returned
 * from handlers and middleware with `returnServerError(code)` and skip this.
 */
export function handleServerError(error: Error, actionName: string | undefined): ActionErrorCode {
  logger.error({ err: error, actionName }, "server action failed");
  Sentry.captureException(error, { tags: { actionName } });
  return "unavailable";
}

/** Stops the action with `rate_limited` when the caller is over the rule's limit. */
export async function enforceBurst(rule: BurstRule, key: string): Promise<void> {
  if (!(await withinBurstLimit(rule, key))) returnServerError<ActionErrorCode>("rate_limited");
}

const baseClient = createSafeActionClient({
  defineMetadataSchema: () => z.object({ actionName: z.string().min(1) }),
  handleServerError: (error, { metadata }) => handleServerError(error, metadata?.actionName),
});

/**
 * Actions anyone may call (sign up, log in, reset). Handlers apply their own
 * per-IP burst rule with `enforceBurst(rule, ctx.ip)`.
 */
export const publicAction = baseClient.use(async ({ next }) => {
  const ip = clientIp(await headers()) ?? "unknown";
  return next({ ctx: { ip } });
});

/**
 * Actions for a signed-in, active account (ARCHITECTURE §5.1). The session is
 * resolved from the database; banned or pending-deletion accounts never reach
 * the handler. Every call counts against the default write burst.
 */
export const userAction = publicAction.use(async ({ next, ctx }) => {
  const session = await getSession();
  if (!session) returnServerError<ActionErrorCode>("unauthorized");
  await enforceBurst("userWrite", session.user.id);
  return next({
    ctx: {
      ip: ctx.ip,
      user: { id: session.user.id, email: session.user.email, name: session.user.name },
      sessionId: session.session.id,
    },
  });
});
