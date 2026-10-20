import { isActionErrorCode, type ActionErrorCode } from "@/lib/errors";

/**
 * A Server Action's typed failure, thrown so TanStack Query treats it as an
 * error. Only the code crosses the boundary (AGENT_RULES §2), never a message.
 */
export class ActionError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode) {
    super(code);
    this.name = "ActionError";
    this.code = code;
  }
}

/** What every next-safe-action call resolves to (or undefined if the request never finished). */
type SafeActionResult<T> = { data?: T; serverError?: unknown; validationErrors?: unknown } | undefined;

/**
 * Turns a next-safe-action result into its data, or throws an ActionError.
 * Use it as the body of a `queryFn` / `mutationFn`:
 * `mutationFn: async (input) => unwrap(await removePantryItem(input))`.
 */
export function unwrap<T>(result: SafeActionResult<T>): T {
  if (result?.data !== undefined) return result.data;
  if (isActionErrorCode(result?.serverError)) throw new ActionError(result.serverError);
  if (result?.validationErrors) throw new ActionError("invalid");
  throw new ActionError("unavailable");
}

/** The code to show for any failure: typed ones keep theirs, network or unknown failures read as `unavailable`. */
export function errorCode(error: unknown): ActionErrorCode {
  return error instanceof ActionError ? error.code : "unavailable";
}

/** Codes where asking again can't help (signed out, not allowed, gone, bad input, over a limit). */
const FINAL: ReadonlySet<ActionErrorCode> = new Set([
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid",
  "rate_limited",
  "quota_exceeded",
  "plan_required",
  "conflict",
]);

/** Reads retry twice after a dropped connection or an outage, never after a final answer. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ActionError && FINAL.has(error.code)) return false;
  return failureCount < 2;
}
