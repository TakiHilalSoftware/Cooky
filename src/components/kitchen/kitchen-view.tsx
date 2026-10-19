"use client";

import { PinIcon, PinOffIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { IngredientNameField } from "@/components/dishes/ingredient-name-field";
import { IconButton } from "@/components/feedback/icon-button";
import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { addPantryItems, removePantryItem, setPantryStaple } from "@/server/actions/kitchen";
import type { PantryDto, PantryItemDto } from "@/server/features/kitchen/dto";

/**
 * My kitchen (PRD §3.4): what's at home. Staples ("always have") are never
 * counted as missing in Cook. Every change saves at once; removing offers Undo.
 */
export function KitchenView({ pantry }: { pantry: PantryDto }) {
  const t = useTranslations("kitchen");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const online = useOnline();
  // Shown at once; the server's next render (after revalidation) wins.
  const [items, setItems] = useState(pantry.items);
  const [seen, setSeen] = useState(pantry);
  if (seen !== pantry) {
    setSeen(pantry);
    setItems(pantry.items);
  }
  const [name, setName] = useState("");
  const [asStaple, setAsStaple] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  async function add(names: string[], staple: boolean) {
    if (!online) return toast.error(t("offline"));
    const result = await addPantryItems({ names, staple });
    if (result?.data) return true;
    toast.error(
      result?.serverError === "conflict" ? t("full", { limit: pantry.limit }) : messages.action(result?.serverError),
    );
    return false;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const typed = name.trim();
    if (!typed) return;
    setAdding(true);
    const ok = await add([typed], asStaple);
    setAdding(false);
    if (ok) {
      setName("");
      setAddedCount((n) => n + 1);
      toast.success(t("added", { name: typed }));
    }
  }

  async function onRemove(item: PantryItemDto) {
    if (!online) return toast.error(t("offline"));
    setItems((list) => list.filter((i) => i.id !== item.id));
    const result = await removePantryItem({ id: item.id });
    if (!result?.data) {
      setItems(pantry.items);
      return toast.error(messages.action(result?.serverError));
    }
    toastUndo(t("removed", { name: item.name }), {
      undoLabel: tCommon("undo"),
      onUndo: () => void add([item.name], item.isStaple),
    });
  }

  async function onToggleStaple(item: PantryItemDto) {
    if (!online) return toast.error(t("offline"));
    const staple = !item.isStaple;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, isStaple: staple } : i)));
    const result = await setPantryStaple({ id: item.id, staple });
    if (!result?.data) {
      setItems(pantry.items);
      toast.error(messages.action(result?.serverError));
    }
  }

  const staples = items.filter((i) => i.isStaple);
  const fresh = items.filter((i) => !i.isStaple);
  const suggested = pantry.suggestedStaples.filter((s) => !items.some((i) => i.name === s));

  return (
    <div className="space-y-8">
      <form onSubmit={onAdd} className="space-y-3 rounded-3xl border border-border bg-card p-5 sm:p-6">
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
          <Button type="submit" disabled={adding || !name.trim()}>
            {adding ? <Spinner data-icon="inline-start" /> : <PlusIcon aria-hidden="true" data-icon="inline-start" />}
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
                  onClick={async () => {
                    if (await add([staple], true)) toast.success(t("added", { name: staple }));
                  }}
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
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-0.5 rounded-full border ps-4 pe-1",
                item.isStaple ? "border-primary-strong bg-secondary" : "border-border bg-card",
              )}
            >
              <span className="py-2 font-medium break-words">{item.name}</span>
              <IconButton
                label={item.isStaple ? t("unmakeStaple", { name: item.name }) : t("makeStaple", { name: item.name })}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
