"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { toastUndo } from "@/components/feedback/toast-undo";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { useRouter } from "@/i18n/navigation";
import { restoreDish } from "@/server/actions/dishes";

/**
 * The Undo toast after deleting a dish from its page (PRD §3.10). It lives on
 * the box, the page the person lands on, so Undo still works there.
 */
export function DeletedDishUndo({ dish }: { dish: { id: string; name: string } }) {
  const t = useTranslations("dishes.page");
  const tCommon = useTranslations("common");
  const onActionError = useActionErrorHandler();
  const router = useRouter();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (shown.current === dish.id) return;
    shown.current = dish.id;
    // Drop ?deleted= so a reload or Back doesn't offer Undo again.
    router.replace("/dishes", { scroll: false });
    toastUndo(t("deleted", { name: dish.name }), {
      undoLabel: tCommon("undo"),
      onUndo: async () => {
        const undone = await restoreDish({ id: dish.id });
        if (undone?.data) toast.success(t("restored", { name: dish.name }));
        else onActionError(undone?.serverError, "dishes");
      },
    });
  }, [dish, router, t, tCommon, onActionError]);

  return null;
}
