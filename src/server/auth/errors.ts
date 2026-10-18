import "server-only";

import { isAPIError } from "better-auth/api";

/**
 * Better Auth's error code (e.g. "INVALID_EMAIL_OR_PASSWORD"), or null for
 * anything that isn't a Better Auth error. A specific code always wins (a
 * lockout is a 429 too); otherwise 429 becomes "RATE_LIMITED" and other bare
 * errors report their HTTP status name (e.g. "UNAUTHORIZED").
 */
export function authErrorCode(error: unknown): string | null {
  if (!isAPIError(error)) return null;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  if (typeof code === "string" && code.length > 0) return code;
  if (error.statusCode === 429) return "RATE_LIMITED";
  return typeof error.status === "string" ? error.status : String(error.statusCode);
}
