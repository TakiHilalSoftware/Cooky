import type * as SentryModule from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION } from "./sentry-privacy";

// The Sentry browser SDK is ~100 KB gzip. It's loaded only when a DSN is set,
// so routes stay within the PRD §3.10 JS budget while error tracking is off.
// NEXT_PUBLIC_SENTRY_DSN is on the public allow-list and inlined at build time.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sentry: Promise<typeof SentryModule> | undefined;

function loadSentry() {
  if (!dsn) return undefined;
  sentry ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({ dsn, dataCollection: SENTRY_DATA_COLLECTION, tracesSampleRate: 0.1 });
    return Sentry;
  });
  return sentry;
}

/** Initialises browser error tracking when configured. */
export function initClientErrorTracking() {
  void loadSentry();
}

/** Reports a client-side error. A no-op until a Sentry DSN is configured. */
export function reportClientError(error: unknown) {
  void loadSentry()?.then((Sentry) => Sentry.captureException(error));
}
