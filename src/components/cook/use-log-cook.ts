"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import type { CookSource } from "@/lib/dishes";
import { logCook, undoLogCook } from "@/server/actions/cook";

/** "Log it for today", with Undo (PRD §3.10), from Cook, the dish page and cooking mode. */
export function useLogCook() {
  const t = useTranslations("cook");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const online = useOnline();
  const [pending, setPending] = useState<string | null>(null);

  async function log(dish: { id: string; name: string }, options: { source?: CookSource; finished?: string[] } = {}) {
    if (!online) {
      toast.error(t("offline"));
      return false;
    }
    setPending(dish.id);
    const result = await logCook({
      dishId: dish.id,
      source: options.source ?? "cook",
      finished: options.finished ?? [],
    });
    setPending(null);
    if (!result?.data) {
      toast.error(messages.action(result?.serverError));
      return false;
    }
    const entry = result.data;
    toastUndo(t("logged", { name: dish.name }), {
      undoLabel: tCommon("undo"),
      onUndo: () => void undoLogCook({ id: entry.id }),
    });
    return true;
  }

  return { log, pending };
}
