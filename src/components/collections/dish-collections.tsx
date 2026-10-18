"use client";

import { FolderIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { checkFields } from "@/lib/forms";
import { createCollection, setDishCollections } from "@/server/actions/collections";
import type { CollectionAllowanceDto, CollectionDto } from "@/server/features/collections/dto";
import { COLLECTION_NAME_MAX, createCollectionSchema } from "@/server/features/collections/schema";

type DishCollectionsProps = {
  dishId: string;
  dishName: string;
  collectionIds: string[];
  collections: CollectionDto[];
  allowance: CollectionAllowanceDto;
};

/** Where a dish lives: its collections as links, and a dialog to change them (or make a new one). */
export function DishCollections({ dishId, dishName, collectionIds, collections, allowance }: DishCollectionsProps) {
  const t = useTranslations("collections");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const newId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(collectionIds);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const save = useAction(setDishCollections);
  const create = useAction(createCollection);
  const current = collections.filter((c) => collectionIds.includes(c.id));

  function openDialog() {
    setSelected(collectionIds);
    setNewName("");
    setNewError(null);
    setOpen(true);
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((list) => (on ? [...list, id] : list.filter((x) => x !== id)));

  async function addCollection(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const check = checkFields(createCollectionSchema, { name: newName });
    if (!check.ok) return setNewError(messages.field(check.errors.name));
    const result = await create.executeAsync(check.data);
    if (result.data) {
      // The new collection is ticked straight away: that's why it was made.
      setSelected((list) => [...list, result.data!.id]);
      setNewName("");
      setNewError(null);
      return;
    }
    if (result.serverError === "conflict") return setNewError(t("nameTaken"));
    if (result.serverError === "quota_exceeded") {
      setOpen(false);
      return onActionError(result.serverError, "collections");
    }
    setNewError(messages.action(result.serverError));
  }

  async function onSave() {
    const result = await save.executeAsync({ dishId, collectionIds: selected });
    if (result.data) {
      toast.success(t("saved"));
      setOpen(false);
    } else toast.error(messages.action(result.serverError));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {current.length > 0 ? (
        <>
          <span className="text-sm text-muted-foreground">{t("dishLabel")}</span>
          <ul className="flex flex-wrap gap-1.5">
            {current.map((c) => (
              <li key={c.id}>
                <Badge asChild variant="outline" className="h-7 px-3">
                  <Link href={`/dishes?collection=${c.id}`}>{c.name}</Link>
                </Badge>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Button variant="outline" size="sm" aria-label={t("manageLabel", { name: dishName })} onClick={openDialog}>
        <FolderIcon aria-hidden="true" data-icon="inline-start" />
        {t("manage")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t("dialogTitle", { name: dishName })}</DialogTitle>
            <DialogDescription>{t("dialogBody")}</DialogDescription>
          </DialogHeader>
          {collections.length === 0 && selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {[...collections, ...pendingCreated(collections, selected, create.result.data)].map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
                    <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <form noValidate onSubmit={addCollection} className="space-y-1.5">
            <label htmlFor={newId} className="text-sm font-medium">
              {t("newInline")}
            </label>
            <div className="flex gap-2">
              <Input
                id={newId}
                value={newName}
                maxLength={COLLECTION_NAME_MAX}
                placeholder={t("namePlaceholder")}
                autoComplete="off"
                onChange={(e) => setNewName(e.target.value)}
                aria-invalid={newError ? true : undefined}
                aria-describedby={newError ? `${newId}-error` : undefined}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={create.isPending || !allowanceAllows(allowance, collections, create.result.data)}
              >
                {create.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlusIcon aria-hidden="true" data-icon="inline-start" />
                )}
                {t("add")}
              </Button>
            </div>
            {newError ? (
              <p id={`${newId}-error`} className="text-sm text-destructive">
                {newError}
              </p>
            ) : null}
            {!allowanceAllows(allowance, collections, create.result.data) && allowance.limit !== null ? (
              <p className="text-xs text-muted-foreground">{t("atCap", { limit: allowance.limit })}</p>
            ) : null}
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={onSave} disabled={save.isPending}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              {save.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A collection created in this dialog shows up before the page refreshes with it. */
function pendingCreated(
  collections: CollectionDto[],
  selected: string[],
  created: { id: string; name: string } | undefined,
): CollectionDto[] {
  if (!created || collections.some((c) => c.id === created.id) || !selected.includes(created.id)) return [];
  return [{ id: created.id, name: created.name, dishCount: 0 }];
}

/** Room for one more collection, counting one just created here. */
function allowanceAllows(
  allowance: CollectionAllowanceDto,
  collections: CollectionDto[],
  created: { id: string } | undefined,
): boolean {
  if (allowance.limit === null) return true;
  const extra = created && !collections.some((c) => c.id === created.id) ? 1 : 0;
  return allowance.count + extra < allowance.limit;
}
