import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { logger } from "@/server/observability/logger";

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

const baseClient = createSafeActionClient({
  defineMetadataSchema: () => z.object({ actionName: z.string().min(1) }),
  handleServerError: (error, { metadata }) => handleServerError(error, metadata?.actionName),
});

/**
 * Entry point for actions that anyone may call. The per-IP burst limit is
 * added here when Upstash is connected; userAction, adminAction and
 * meteredAction(feature) are built on top of it with auth (Phase 1) and
 * billing (Phase 2). See docs/ARCHITECTURE.md §5.1.
 */
export const publicAction = baseClient;
