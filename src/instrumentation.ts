import * as Sentry from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-privacy";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("@/server/env");

  // Local-only misconfigurations disable one feature instead of the app; say
  // so once, at startup, rather than at the first sign-up.
  const { emailSetupProblem } = await import("@/server/notify/email/send");
  const emailProblem = emailSetupProblem();
  if (emailProblem) {
    const { logger } = await import("@/server/observability/logger");
    logger.warn({ reason: emailProblem }, "emails will be logged, not sent");
  }

  // Error tracking stays off until a DSN is configured (docs/SETUP_KEYS.md §13).
  if (!env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    environment: env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
