"use client";

import { UtensilsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { getAttachableDishes } from "@/server/actions/messages";
import type { AttachableDishDto } from "@/server/features/messages/dto";

type AttachDishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  otherName: string;
  onPick: (dish: AttachableDishDto) => void;
};

type LoadState =
  { status: "loading" } | { status: "ready"; dishes: AttachableDishDto[] } | { status: "error"; message: string };

/** Pick one of your dishes this friend can open (PRD §3.6: "your shareable dishes"). */
export function AttachDishDialog({ open, onOpenChange, conversationId, otherName, onPick }: AttachDishDialogProps) {
  const t = useTranslations("messages.attach");
  const messages = useFormMessages();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void getAttachableDishes({ conversationId }).then((result) => {
      if (!current) return;
      setState(
        result?.data
          ? { status: "ready", dishes: result.data.dishes }
          : { status: "error", message: messages.action(result?.serverError) },
      );
    });
    return () => {
      current = false;
    };
  }, [open, conversationId, attempt, messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name: otherName })}</DialogDescription>
        </DialogHeader>
        {state.status === "loading" ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t("loading")}
          </p>
        ) : state.status === "error" ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ) : state.dishes.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-border p-4 text-sm">
            <p className="text-muted-foreground">{t("empty", { name: otherName })}</p>
            <Button asChild variant="outline">
              <Link href="/dishes">{t("goToDishes")}</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid max-h-80 gap-1 overflow-y-auto pe-1">
            {state.dishes.map((dish) => (
              <li key={dish.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(dish);
                    onOpenChange(false);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl p-2 text-start outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {dish.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dish.photoUrl}
                      alt=""
                      width={56}
                      height={42}
                      className="h-10 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <UtensilsIcon aria-hidden="true" className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 truncate font-medium">{dish.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
