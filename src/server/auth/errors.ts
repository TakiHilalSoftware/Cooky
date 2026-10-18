import "server-only";

import { isAPIError } from "better-auth/api";

/** Better Auth's error code (e.g. "INVALID_EMAIL_OR_PASSWORD"), or null for anything else. */
export function authErrorCode(error: unknown): string | null {
  if (!isAPIError(error)) return null;
  if (error.statusCode === 429) return "RATE_LIMITED";
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : null;
}
