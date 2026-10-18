"use client";

import { EllipsisVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler, useUpgradeSheet } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { deleteCollection, restoreCollection } from "@/server/actions/collections";
import type { CollectionAllowanceDto, CollectionDto } from "@/server/features/collections/dto";

import { CollectionNameDialog } from "./collection-name-dialog";

type CollectionBarProps = {
  collections: CollectionDto[];
  allowance: CollectionAllowanceDto;
  active: CollectionDto | null;
};

/**
 * My Dishes by collection: a row of chips (All, then each collection), a way
 * to make a new one, and rename/delete for the one being shown.
 */
export function CollectionBar({ collections, allowance, active }: CollectionBarProps) {
  const t = useTranslations("collections");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const openUpgrade = useUpgradeSheet();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);

  function newCollection() {
    if (allowance.canAdd) setCreating(true);
    else openUpgrade({ feature: "collections", reason: "quota_exceeded" });
  }

  async function remove(collection: CollectionDto) {
    const result = await deleteCollection({ id: collection.id });
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    router.replace("/dishes", { scroll: false });
    toastUndo(t("deleted", { name: collection.name }), {
      undoLabel: tCommon("undo"),
      onUndo: async () => {
        const undone = await restoreCollection({ id: collection.id });
        if (undone?.data) toast.success(t("restored", { name: collection.name }));
        else if (undone?.serverError === "conflict") toast.error(t("nameTaken"));
        else onActionError(undone?.serverError, "collections");
      },
    });
  }

  const chip = (selected: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
      selected
        ? "border-primary-strong bg-primary text-primary-foreground"
        : "border-border bg-card hover:border-primary-strong",
    );

  return (
    <div className="space-y-3">
      <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 sm:flex-wrap">
          <li>
            <Link href="/dishes" scroll={false} aria-current={active ? undefined : "page"} className={chip(!active)}>
              {t("all")}
            </Link>
          </li>
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dishes?collection=${c.id}`}
                scroll={false}
                aria-current={active?.id === c.id ? "page" : undefined}
                title={t("count", { count: c.dishCount })}
                className={chip(active?.id === c.id)}
              >
                <span className="max-w-48 truncate">{c.name}</span>
                <span className="text-xs tabular-nums opacity-80">{c.dishCount}</span>
              </Link>
            </li>
          ))}
          <li>
            <Button variant="outline" className="min-h-11 rounded-full" onClick={newCollection}>
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              {t("new")}
            </Button>
          </li>
        </ul>
      </nav>
      {allowance.limit !== null ? (
        <p
          className="text-xs text-muted-foreground"
          title={allowance.canAdd ? undefined : t("atCap", { limit: allowance.limit })}
        >
          {t("allowance", { count: allowance.count, limit: allowance.limit })}
        </p>
      ) : null}

      {active ? (
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate font-heading text-2xl">{active.name}</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("options", { name: active.name })}>
                <EllipsisVerticalIcon aria-hidden="true" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="min-h-10" onSelect={() => setRenaming(true)}>
                <PencilIcon aria-hidden="true" />
                {t("rename")}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10" variant="destructive" onSelect={() => remove(active)}>
                <Trash2Icon aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <CollectionNameDialog
        open={creating}
        onOpenChange={setCreating}
        onDone={(c) => router.push(`/dishes?collection=${c.id}`, { scroll: false })}
      />
      {active ? (
        <CollectionNameDialog key={active.id} open={renaming} onOpenChange={setRenaming} collection={active} />
      ) : null}
    </div>
  );
}
