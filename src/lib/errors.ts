/**
 * The only error values a Server Action may return to the browser
 * (docs/ARCHITECTURE.md §5.1). Each maps to a translated message under
 * `errors.*` in messages/{en,fr,ar}.json.
 */
export const ACTION_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid",
  "rate_limited",
  "quota_exceeded",
  "plan_required",
  "conflict",
  "unavailable",
] as const;

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number];

export function isActionErrorCode(value: unknown): value is ActionErrorCode {
  return typeof value === "string" && (ACTION_ERROR_CODES as readonly string[]).includes(value);
}

/** Message key for an action error, e.g. `t(errorMessageKey(code))`. */
export function errorMessageKey(code: ActionErrorCode) {
  return `errors.${code}` as const;
}
