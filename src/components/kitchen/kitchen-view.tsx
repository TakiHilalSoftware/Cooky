"use client";

import { PinIcon, PinOffIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { IngredientNameField } from "@/components/dishes/ingredient-name-field";
import { haptic } from "@/components/feedback/haptics";
import { IconButton } from "@/components/feedback/icon-button";
import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { errorCode } from "@/components/query/action-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ReadyToCookDto } from "@/server/features/cook/dto";
import type { PantryDto, PantryItemDto } from "@/server/features/kitchen/dto";

import { ReadyToCookPanel } from "./ready-to-cook-panel";
import { isOptimistic } from "./pantry-preview";
import { useAddPantryItems, usePantry, useRemovePantryItem, useSetPantryStaple } from "./use-kitchen";

/**
 * My kitchen (PRD §3.4): what's at home. Staples ("always have") are never
 * counted as missing in Cook. Every change shows at once and saves in the
 * background (the server's answer wins); removing offers Undo. Beside it,
 * "Ready to cook" follows every change.
 */
export function KitchenView({ pantry, ready }: { pantry: PantryDto; ready: ReadyToCookDto }) {
  const t = useTranslations("kitchen");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const online = useOnline();
  const { data } = usePantry(pantry);
  const items = data.items;
  const addItems = useAddPantryItems();
  const removeItem = useRemovePantryItem();
  const setStaple = useSetPantryStaple();
  const [name, setName] = useState("");
  const [asStaple, setAsStaple] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const guard = () => {
    if (online) return true;
    toast.error(t("offline"));
    return false;
  };
  const failed = (error: unknown) => {
    const code = errorCode(error);
    toast.error(code === "conflict" ? t("full", { limit: data.limit }) : messages.action(code));
  };

  function add(names: string[], staple: boolean, onAdded?: () => void) {
    if (!guard()) return;
    haptic();
    addItems.mutate({ names, staple }, { onSuccess: onAdded, onError: failed });
  }

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const typed = name.trim();
    if (!typed) return;
    if (!guard()) return;
    haptic();
    // Cleared at once: the item already shows below while it saves.
    setName("");
    setAddedCount((n) => n + 1);
    // The field re-mounts (closing its suggestions); keep typing in it.
    requestAnimationFrame(() => document.getElementById("pantry-add")?.focus());
    addItems.mutate(
      { names: [typed], staple: asStaple },
      {
        onSuccess: () => toast.success(t("added", { name: typed })),
        onError: (error) => {
          setName((current) => current || typed);
          failed(error);
        },
      },
    );
  }

  function onRemove(item: PantryItemDto) {
    if (!guard()) return;
    removeItem.mutate(
      { id: item.id },
      {
        onSuccess: () =>
          toastUndo(t("removed", { name: item.name }), {
            undoLabel: tCommon("undo"),
            onUndo: () => add([item.name], item.isStaple),
          }),
        onError: failed,
      },
    );
  }

  function onToggleStaple(item: PantryItemDto) {
    if (!guard()) return;
    setStaple.mutate({ id: item.id, staple: !item.isStaple }, { onError: failed });
  }

  const staples = items.filter((i) => i.isStaple);
  const fresh = items.filter((i) => !i.isStaple);
  const suggested = data.suggestedStaples.filter((s) => !items.some((i) => i.name === s));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      {/* Phones: "Ready to cook" right under the add box, so each change visibly pays off. Desktop: a sticky side column. */}
      <form onSubmit={onAdd} className="space-y-3 rounded-3xl border border-border bg-card p-5 sm:p-6 lg:col-start-1">
        <Label htmlFor="pantry-add" className="text-base">
          {t("addLabel")}
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 sm:flex-1">
            {/* Re-mounted after each add, so the suggestion list closes with the cleared text. */}
            <IngredientNameField
              key={addedCount}
              id="pantry-add"
              value={name}
              onChange={setName}
              placeholder={t("addPlaceholder")}
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={!name.trim()}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            {t("add")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="pantry-staple" checked={asStaple} onCheckedChange={(v) => setAsStaple(v === true)} />
          <Label htmlFor="pantry-staple" className="font-normal">
            {t("addAsStaple")}
          </Label>
        </div>
      </form>
      <aside className="@container min-w-0 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <ReadyToCookPanel
          initial={ready}
          onHave={(have) => add([have], false, () => toast.success(t("added", { name: have })))}
        />
      </aside>
      <div className="min-w-0 space-y-8 lg:col-start-1">
        <ItemSection
          title={t("haveHeading")}
          hint={t("haveHint")}
          empty={t("emptyHave")}
          items={fresh}
          onRemove={onRemove}
          onToggleStaple={onToggleStaple}
        />
        <ItemSection
          title={t("staplesHeading")}
          hint={t("staplesHint")}
          empty={t("emptyStaples")}
          items={staples}
          onRemove={onRemove}
          onToggleStaple={onToggleStaple}
        />

        {suggested.length > 0 ? (
          <section aria-labelledby="pantry-suggested" className="space-y-3">
            <div className="space-y-1">
              <h2 id="pantry-suggested" className="font-heading text-xl">
                {t("suggestedHeading")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("suggestedHint")}</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {suggested.map((staple) => (
                <li key={staple}>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => add([staple], true, () => toast.success(t("added", { name: staple })))}
                  >
                    <PlusIcon aria-hidden="true" data-icon="inline-start" />
                    {staple}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ItemSection({
  title,
  hint,
  empty,
  items,
  onRemove,
  onToggleStaple,
}: {
  title: string;
  hint: string;
  empty: string;
  items: PantryItemDto[];
  onRemove: (item: PantryItemDto) => void;
  onToggleStaple: (item: PantryItemDto) => void;
}) {
  const t = useTranslations("kitchen");
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-heading text-2xl">
          {title} <span className="text-base font-normal text-muted-foreground tabular-nums">({items.length})</span>
        </h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => {
            // Shown before the server has saved it: it gets real buttons once it has an id.
            const saving = isOptimistic(item);
            return (
              <li
                key={item.id}
                aria-busy={saving}
                className={cn(
                  "flex max-w-full items-center gap-0.5 rounded-full border ps-4 pe-1",
                  item.isStaple ? "border-primary-strong bg-secondary" : "border-border bg-card",
                  saving && "border-dashed",
                )}
              >
                <span className={cn("min-w-0 py-2 font-medium break-words", saving && "text-muted-foreground")}>
                  {item.name}
                </span>
                {saving ? (
                  <span
                    role="status"
                    title={t("saving", { name: item.name })}
                    className="flex size-11 items-center justify-center"
                  >
                    <Spinner aria-hidden="true" />
                    <span className="sr-only">{t("saving", { name: item.name })}</span>
                  </span>
                ) : (
                  <>
                    <IconButton
                      label={
                        item.isStaple ? t("unmakeStaple", { name: item.name }) : t("makeStaple", { name: item.name })
                      }
                      aria-pressed={item.isStaple}
                      className="rounded-full"
                      onClick={() => onToggleStaple(item)}
                    >
                      {item.isStaple ? <PinOffIcon aria-hidden="true" /> : <PinIcon aria-hidden="true" />}
                    </IconButton>
                    <IconButton
                      label={t("remove", { name: item.name })}
                      className="rounded-full"
                      onClick={() => onRemove(item)}
                    >
                      <XIcon aria-hidden="true" />
                    </IconButton>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
