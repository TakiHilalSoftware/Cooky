"use client";

import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { cn } from "@/lib/utils";
import { setFavorite } from "@/server/actions/dishes";

type FavoriteButtonProps = { dishId: string; name: string; favorite: boolean; className?: string };

/** Star toggle: flips instantly, and the server's answer wins (PRD §3.10). */
export function FavoriteButton({ dishId, name, favorite, className }: FavoriteButtonProps) {
  const t = useTranslations("dishes.favorite");
  const messages = useFormMessages();
  const [shown, setShown] = useOptimistic(favorite);
  const save = useAction(setFavorite);

  function toggle() {
    const next = !shown;
    startTransition(async () => {
      setShown(next);
      const result = await save.executeAsync({ dishId, favorite: next });
      if (result.serverError || result.validationErrors) toast.error(messages.action(result.serverError));
    });
  }

  return (
    <IconButton
      label={shown ? t("remove", { name }) : t("add", { name })}
      aria-pressed={shown}
      onClick={toggle}
      className={className}
    >
      <StarIcon
        aria-hidden="true"
        className={cn("transition-colors", shown ? "fill-primary text-primary-strong" : "text-muted-foreground")}
      />
    </IconButton>
  );
}
