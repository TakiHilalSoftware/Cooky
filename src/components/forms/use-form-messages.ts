"use client";

import { useTranslations } from "next-intl";

import { isActionErrorCode } from "@/lib/errors";
import { isValidationKey } from "@/lib/validation-keys";

/**
 * Turns what forms receive (schema message keys, action error codes) into
 * copy. Anything unexpected falls back to a generic message, never raw text.
 */
export function useFormMessages() {
  const tValidation = useTranslations("validation");
  const tErrors = useTranslations("errors");
  return {
    field: (key: string | undefined) => {
      if (!key) return null;
      return isValidationKey(key) ? tValidation(key) : tErrors("invalid");
    },
    action: (code: unknown) => (isActionErrorCode(code) ? tErrors(code) : tErrors("unavailable")),
  };
}
