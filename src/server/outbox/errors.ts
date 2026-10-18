import "server-only";

/**
 * A job failure that retrying can't fix (bad sender, revoked API key, invalid
 * recipient). The drain dead-letters it immediately instead of retrying for
 * hours, and keeps the provider's message in `last_error` for the fix.
 */
export class PermanentJobError extends Error {
  override name = "PermanentJobError";
}
