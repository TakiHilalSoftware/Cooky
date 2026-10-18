import type { FieldErrorKeys } from "@/lib/forms";

/**
 * Moves focus to the first field (in reading order) that has an error, so
 * keyboard and screen-reader users land where they need to act. Fields are
 * matched by `name`, or `data-field` for custom controls like checkboxes.
 */
export function focusFirstInvalid(form: HTMLFormElement | null, errors: FieldErrorKeys): void {
  if (!form) return;
  const candidates = form.querySelectorAll<HTMLElement>("[name], [data-field]");
  for (const element of candidates) {
    const field = element.dataset.field ?? element.getAttribute("name");
    if (!field || !(field in errors)) continue;
    if (element.getAttribute("aria-hidden") === "true" || (element as HTMLInputElement).type === "hidden") continue;
    element.focus();
    return;
  }
}
