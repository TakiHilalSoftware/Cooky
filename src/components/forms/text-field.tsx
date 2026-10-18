"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps = Omit<ComponentProps<typeof Input>, "id" | "aria-invalid" | "aria-describedby"> & {
  label: string;
  hint?: string;
  /** Translated error text, or null when the field is valid. */
  error?: string | null;
  /** Replaces the plain input, e.g. a password input with a show/hide toggle. */
  renderInput?: (props: ComponentProps<typeof Input>) => ReactNode;
};

/** Label, input, hint and error wired together for screen readers (WCAG 1.3.1, 3.3.1). */
export function TextField({ label, hint, error, renderInput, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") || undefined;
  const props = { ...inputProps, id, "aria-invalid": invalid || undefined, "aria-describedby": describedBy };

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {renderInput ? renderInput(props) : <Input {...props} />}
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}
