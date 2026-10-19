"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What happens, in plain words, including what can't be undone. */
  description: ReactNode;
  confirmLabel: string;
  /** Return false to keep the dialog open (e.g. the action failed and said why). */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  destructive?: boolean;
};

/**
 * Confirmation for irreversible or wide-impact actions only (PRD §3.10);
 * reversible deletes use an Undo toast instead.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  const tCommon = useTranslations("common");
  const [pending, setPending] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async (event) => {
              // Stay open while working; close only when it went through.
              event.preventDefault();
              setPending(true);
              const keepOpen = (await onConfirm()) === false;
              setPending(false);
              if (!keepOpen) onOpenChange(false);
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
