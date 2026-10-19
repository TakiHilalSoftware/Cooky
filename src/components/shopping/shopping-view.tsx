"use client";

import {
  CalendarRangeIcon,
  CheckIcon,
  ChefHatIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  Share2Icon,
  ShoppingBasketIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { useDishCopy } from "@/components/dishes/use-dish-copy";
import { EmptyState } from "@/components/feedback/empty-state";
import { IconButton } from "@/components/feedback/icon-button";
import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { offlineEnabled, queueTick, readValue, writeValue, type ShoppingSnapshot } from "@/components/offline/store";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { AISLES } from "@/lib/dishes";
import { cn } from "@/lib/utils";
import {
  addShoppingItem,
  clearShoppingList,
  doneShopping,
  removeShoppingItem,
  restoreShoppingItem,
  toggleShoppingItem,
} from "@/server/actions/shopping";
import type { ShoppingItemDto, ShoppingListDto } from "@/server/features/shopping/dto";

import { HouseholdPanel } from "./household-panel";

/** When a tick happened on this device; the server keeps the newest (offline replays can arrive late). */
const tickedAt = () => new Date().toISOString();

/**
 * The shopping list (PRD §3.5): one merged list grouped by aisle. Ticks are
 * instant; "Done shopping" clears what was bought and can stock My kitchen.
 */
export function ShoppingView({ list }: { list: ShoppingListDto }) {
  const t = useTranslations("shopping");
  const tCommon = useTranslations("common");
  const { amount } = useDishCopy();
  const messages = useFormMessages();
  const online = useOnline();
  const [items, setItems] = useState(list.items);
  const [seen, setSeen] = useState(list);
  if (seen !== list) {
    setSeen(list);
    setItems(list.items);
  }
  const [typed, setTyped] = useState("");
  const [adding, setAdding] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [stockKitchen, setStockKitchen] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const checkedCount = items.filter((i) => i.checked).length;

  // Keeps this device's copy of the list current, for the offline page.
  useEffect(() => {
    if (!offlineEnabled()) return;
    void (async () => {
      const owner = await readValue<string>("owner");
      if (!owner) return;
      const snapshot: ShoppingSnapshot = {
        owner,
        version: list.version,
        savedAt: tickedAt(),
        groups: AISLES.map((aisle) => ({
          label: t(`aisles.${aisle}`),
          items: items
            .filter((i) => i.aisle === aisle)
            .map((i) => ({ id: i.id, name: i.name, amount: amount(i.amount, i.unit), checked: i.checked })),
        })).filter((g) => g.items.length > 0),
      };
      await writeValue("snapshot", snapshot);
    })();
  }, [items, list.version, t, amount]);
  const label = (item: ShoppingItemDto) => amount(item.amount, item.unit);
  const guard = () => {
    if (online) return true;
    toast.error(t("offline"));
    return false;
  };

  async function toggle(item: ShoppingItemDto) {
    const checked = !item.checked;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, checked } : i)));
    // PRD §4: the one write that works offline. Queued here, replayed on reconnect (newest change wins).
    if (!online) return void queueTick({ itemId: item.id, checked, at: tickedAt() });
    const result = await toggleShoppingItem({ id: item.id, checked, at: tickedAt() });
    if (!result?.data) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)));
      toast.error(messages.action(result?.serverError));
    }
  }

  async function remove(item: ShoppingItemDto) {
    if (!guard()) return;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const result = await removeShoppingItem({ id: item.id });
    if (!result?.data) {
      setItems(list.items);
      return toast.error(messages.action(result?.serverError));
    }
    const removed = result.data;
    toastUndo(t("removed", { name: item.name }), {
      undoLabel: tCommon("undo"),
      onUndo: () => void restoreShoppingItem(removed),
    });
  }

  async function addTyped(event: FormEvent) {
    event.preventDefault();
    const name = typed.trim();
    if (!name || !guard()) return;
    setAdding(true);
    const result = await addShoppingItem({ name });
    setAdding(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    setTyped("");
  }

  async function finish() {
    setBusy(true);
    const result = await doneShopping({ addToKitchen: stockKitchen });
    setBusy(false);
    setDoneOpen(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(
      result.data.addedToKitchen > 0
        ? t("doneWithKitchen", { count: result.data.bought, kitchen: result.data.addedToKitchen })
        : t("done", { count: result.data.bought }),
    );
  }

  async function clear(scope: "checked" | "all") {
    if (!guard()) return;
    setBusy(true);
    const result = await clearShoppingList({ scope });
    setBusy(false);
    setClearOpen(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(t("cleared", { count: result.data.removed }));
  }

  async function share() {
    const text = [
      t("shareTitle"),
      ...AISLES.flatMap((aisle) =>
        items.filter((i) => i.aisle === aisle && !i.checked).map((i) => `• ${label(i) ? `${label(i)} ` : ""}${i.name}`),
      ),
    ].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: t("shareTitle"), text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success(t("copied"));
      }
    } catch {
      // Closing the share sheet isn't an error worth showing.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={share}>
              <Share2Icon aria-hidden="true" data-icon="inline-start" />
              {t("share")}
            </Button>
            <Button disabled={checkedCount === 0} onClick={() => setDoneOpen(true)}>
              <CheckIcon aria-hidden="true" data-icon="inline-start" />
              {t("doneShopping")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("moreActions")}>
                  <EllipsisVerticalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={checkedCount === 0} onSelect={() => clear("checked")}>
                  {t("clearChecked")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setClearOpen(true)}>
                  <Trash2Icon aria-hidden="true" />
                  {t("clearAll")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium tabular-nums" aria-live="polite">
            {t("progress", { checked: checkedCount, total: items.length })}
          </p>
          <Progress value={(checkedCount / items.length) * 100} aria-hidden="true" className="h-2" />
        </div>
      ) : null}

      <HouseholdPanel household={list.household} />

      <form onSubmit={addTyped} className="flex gap-2">
        <Label htmlFor="shopping-add" className="sr-only">
          {t("addLabel")}
        </Label>
        <Input
          id="shopping-add"
          value={typed}
          maxLength={80}
          placeholder={t("addPlaceholder")}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={adding || !typed.trim()}>
          {adding ? <Spinner data-icon="inline-start" /> : <PlusIcon aria-hidden="true" data-icon="inline-start" />}
          {t("add")}
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyBody")}
          illustration={<ShoppingBasketIcon aria-hidden="true" className="size-14 text-primary-strong" />}
          action={
            <>
              <Button asChild>
                <Link href="/planner">
                  <CalendarRangeIcon aria-hidden="true" data-icon="inline-start" />
                  {t("planWeek")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/cook">
                  <ChefHatIcon aria-hidden="true" data-icon="inline-start" />
                  {t("pickDish")}
                </Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-6">
          {AISLES.map((aisle) => {
            const inAisle = items
              .filter((i) => i.aisle === aisle)
              .sort((a, b) => Number(a.checked) - Number(b.checked));
            if (inAisle.length === 0) return null;
            return (
              <section key={aisle} aria-labelledby={`aisle-${aisle}`} className="space-y-2">
                <h2 id={`aisle-${aisle}`} className="text-sm font-semibold tracking-wide text-primary-strong uppercase">
                  {t(`aisles.${aisle}`)}
                </h2>
                <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
                  {inAisle.map((item) => (
                    <li key={item.id} className="flex items-center gap-1 pe-2">
                      <label className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 ps-4">
                        <Checkbox checked={item.checked} onCheckedChange={() => toggle(item)} className="size-5" />
                        <span className={cn("min-w-0 flex-1", item.checked && "text-muted-foreground line-through")}>
                          {label(item) ? <span className="font-medium tabular-nums">{label(item)} </span> : null}
                          <span className="break-words">{item.name}</span>
                          {item.dishCount > 1 ? (
                            <span className="ms-2 text-xs text-muted-foreground">
                              {t("forDishes", { count: item.dishCount })}
                            </span>
                          ) : null}
                        </span>
                      </label>
                      <IconButton label={t("remove", { name: item.name })} onClick={() => remove(item)}>
                        <XIcon aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("doneTitle")}</DialogTitle>
            <DialogDescription>{t("doneBody", { count: checkedCount })}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox id="stock-kitchen" checked={stockKitchen} onCheckedChange={(v) => setStockKitchen(v === true)} />
            <Label htmlFor="stock-kitchen" className="font-normal">
              {t("stockKitchen")}
            </Label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDoneOpen(false)}>
              {t("cancel")}
            </Button>
            <Button disabled={busy} onClick={finish}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {t("doneConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clearTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("clearBody", { count: items.length })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => clear("all")}>
              {t("clearConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
