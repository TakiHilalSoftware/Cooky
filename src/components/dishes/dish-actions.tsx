"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { deleteDish } from "@/server/actions/dishes";

type DishActionsProps = { dishId: string; readOnly: boolean };

/**
 * Edit and Delete. Deleting is immediate with a 6-second Undo (PRD §3.10),
 * so there's no confirm dialog to click through.
 */
export function DishActions({ dishId, readOnly }: DishActionsProps) {
  const t = useTranslations("dishes.page");
  const messages = useFormMessages();
  const router = useRouter();
  const remove = useAction(deleteDish);

  async function onDelete() {
    const result = await remove.executeAsync({ id: dishId });
    if (!result.data) {
      toast.error(messages.action(result.serverError));
      return;
    }
    // The box shows the Undo toast: it's the page the person is on when they'd tap it.
    router.push(`/dishes?deleted=${dishId}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {readOnly ? null : (
        <Button asChild variant="outline">
          <Link href={`/dishes/${dishId}/edit`}>
            <PencilIcon aria-hidden="true" data-icon="inline-start" />
            {t("edit")}
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        disabled={remove.isPending}
        onClick={onDelete}
      >
        {remove.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Trash2Icon aria-hidden="true" data-icon="inline-start" />
        )}
        {t("delete")}
      </Button>
    </div>
  );
}
