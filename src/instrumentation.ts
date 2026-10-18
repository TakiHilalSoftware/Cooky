import * as Sentry from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-privacy";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("@/server/env");
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
