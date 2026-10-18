"use client";

import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { checkFields } from "@/lib/forms";
import { createCollection, renameCollection } from "@/server/actions/collections";
import { COLLECTION_NAME_MAX, createCollectionSchema } from "@/server/features/collections/schema";

type CollectionNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rename this collection; without it, a new one is created. */
  collection?: { id: string; name: string };
  onDone?: (collection: { id: string; name: string }) => void;
};

/** One dialog for "New collection" and "Rename": a name, checked as you go, saved by the server. */
export function CollectionNameDialog({ open, onOpenChange, collection, onDone }: CollectionNameDialogProps) {
  const t = useTranslations("collections");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const [name, setName] = useState(collection?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const create = useAction(createCollection);
  const rename = useAction(renameCollection);
  const pending = create.isPending || rename.isPending;

  function close(next: boolean) {
    if (!next) {
      setError(null);
      setName(collection?.name ?? "");
    }
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(createCollectionSchema, { name });
    if (!check.ok) return setError(messages.field(check.errors.name));
    const result = collection
      ? await rename.executeAsync({ id: collection.id, name: check.data.name })
      : await create.executeAsync(check.data);
    if (result.data) {
      toast.success(collection ? t("renamed", { name: result.data.name }) : t("created", { name: result.data.name }));
      onDone?.(result.data);
      close(false);
      return;
    }
    if (result.serverError === "conflict") return setError(t("nameTaken"));
    if (result.serverError === "quota_exceeded") {
      close(false);
      return onActionError(result.serverError, "collections");
    }
    setError(messages.action(result.serverError));
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {collection ? t("renameTitle", { name: collection.name }) : t("newTitle")}
            </DialogTitle>
            {collection ? null : <DialogDescription>{t("newBody")}</DialogDescription>}
          </DialogHeader>
          <TextField
            label={t("nameLabel")}
            name="name"
            placeholder={t("namePlaceholder")}
            maxLength={COLLECTION_NAME_MAX}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? (collection ? t("saving") : t("creating")) : collection ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
