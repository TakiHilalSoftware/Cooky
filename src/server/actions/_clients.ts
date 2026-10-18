import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createSafeActionClient, isNavigationError, returnServerError } from "next-safe-action";
import { headers } from "next/headers";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import type { MeteredFeature } from "@/lib/plan-features";
import { clientIp } from "@/server/auth/request-info";
import { getSession, isAdmin } from "@/server/auth/session";
import { logger } from "@/server/observability/logger";
import { withinBurstLimit, type BurstRule } from "@/server/quota/burst";
import { commit, refund, reserve } from "@/server/quota/tries";

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

/** A signed-in, active account, counted against `rule`. */
function signedIn(rule: BurstRule) {
  return publicAction.use(async ({ next, ctx }) => {
    const session = await getSession();
    if (!session) returnServerError<ActionErrorCode>("unauthorized");
    await enforceBurst(rule, session.user.id);
    return next({
      ctx: {
        ip: ctx.ip,
        user: { id: session.user.id, email: session.user.email, name: session.user.name },
        sessionId: session.session.id,
      },
    });
  });
}

/**
 * Actions for a signed-in, active account (ARCHITECTURE §5.1). The session is
 * resolved from the database; banned or pending-deletion accounts never reach
 * the handler. Every call counts against the default write burst.
 */
export const userAction = signedIn("userWrite");

/**
 * Read-only actions that run while someone types (autocomplete). Same session
 * checks as userAction, with a roomier burst so typing never hits the write limit.
 */
export const userReadAction = signedIn("userRead");

/**
 * Actions for admins only (ARCHITECTURE §5.1). The role comes from the
 * database session, never from the client. Used by the admin panel (Phase 7).
 */
export const adminAction = userAction.use(async ({ next }) => {
  const session = await getSession();
  if (!session || !isAdmin(session)) returnServerError<ActionErrorCode>("forbidden");
  return next();
});

/**
 * Actions that spend a try (ARCHITECTURE §5.2): reserve before the work, then
 * commit if it succeeded or refund if it failed, so provider outages never
 * cost the person a try. Out of tries → `quota_exceeded`; not on the plan →
 * `plan_required` (the UI opens the upgrade sheet for both).
 */
export function meteredAction(feature: MeteredFeature) {
  return userAction.use(async ({ next, ctx }) => {
    const reserved = await reserve(ctx.user.id, feature);
    if (!reserved.ok) returnServerError<ActionErrorCode>(reserved.reason);
    try {
      const result = await next({ ctx: { reservation: reserved.reservation } });
      if (result.success) await commit(reserved.reservation);
      else await refund(reserved.reservation);
      return result;
    } catch (error) {
      // A redirect after successful work still spends the try; anything else gives it back.
      if (isNavigationError(error)) await commit(reserved.reservation);
      else await refund(reserved.reservation);
      throw error;
    }
  });
}
