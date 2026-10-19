"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import type { ActionErrorCode } from "@/lib/errors";

/**
 * Runs a planner write: blocked offline with the planner's message, errors as
 * toasts ("conflict" = the day is full), optional Undo. Returns the data or null.
 */
export function usePlannerWrite() {
  const t = useTranslations("planner");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const online = useOnline();

  return async function write<T>(
    run: () => Promise<{ data?: T; serverError?: ActionErrorCode } | undefined>,
    options: { success?: string; undo?: () => void } = {},
  ): Promise<T | null> {
    if (!online) {
      toast.error(t("offline"));
      return null;
    }
    const result = await run();
    if (!result?.data) {
      toast.error(result?.serverError === "conflict" ? t("dayFull") : messages.action(result?.serverError));
      return null;
    }
    if (options.undo) toastUndo(options.success ?? "", { undoLabel: tCommon("undo"), onUndo: options.undo });
    else if (options.success) toast.success(options.success);
    return result.data;
  };
}
