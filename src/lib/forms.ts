import type { z } from "zod";

export type FieldErrorKeys = Record<string, string>;

/**
 * Runs a Zod schema as an instant form hint (AGENT_RULES §5: the server's
 * answer still wins). Returns the parsed data, or the first message key per
 * top-level field.
 */
export function checkFields<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrorKeys } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrorKeys = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}
