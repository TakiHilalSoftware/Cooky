"use client";

import { DicesIcon, MessageCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";

import { useOnline } from "@/components/app-shell/use-online";
import { ZelligeStar } from "@/components/brand/zellige-star";
import { CookCard } from "@/components/cook/cook-card";
import { TriesMeter } from "@/components/paywall/tries-meter";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link, useRouter } from "@/i18n/navigation";
import type { SpinMode } from "@/lib/dishes";
import { cn } from "@/lib/utils";
import { spinDish } from "@/server/actions/spin";
import type { SpinPageDto, SpinResultDto } from "@/server/features/spin/dto";

/** The wheel turns at least this long, so the pick feels like a spin, not a page load. */
const MIN_SPIN_MS = 1100;
const MAX_INGREDIENTS = 10;

type Outcome = { kind: "result"; result: SpinResultDto } | { kind: "nothing" } | { kind: "offline" } | null;

/**
 * Spin (PRD §3.4): a playful pick, weighted to today's weather and season,
 * from any dish or from those that use the ingredients you name.
 */
export function SpinView({ page }: { page: SpinPageDto }) {
  const t = useTranslations("spin");
  const locale = useLocale();
  const online = useOnline();
  const router = useRouter();
  const onActionError = useActionErrorHandler();
  const [mode, setMode] = useState<SpinMode>("random");
  const [ingredients, setIngredients] = useState<string[]>(page.kitchen.slice(0, MAX_INGREDIENTS));
  const [typed, setTyped] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function spin() {
    if (!online) return setOutcome({ kind: "offline" });
    setSpinning(true);
    setOutcome(null);
    const [result] = await Promise.all([
      spinDish({
        mode,
        ingredients: mode === "ingredients" ? ingredients : [],
        collectionId: collectionId || null,
        locale: locale as "en" | "fr" | "ar",
      }),
      new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
    ]);
    setSpinning(false);
    if (result?.data) {
      setOutcome({ kind: "result", result: result.data });
      // The meter and "picked today" come from the server.
      router.refresh();
      requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    const code = result?.serverError;
    if (code === "not_found") return setOutcome({ kind: "nothing" });
    // Out of spins opens the upgrade sheet; anything else is a toast.
    onActionError(code, "spins");
  }

  function addIngredient(event: FormEvent) {
    event.preventDefault();
    const name = typed.trim();
    if (!name || ingredients.length >= MAX_INGREDIENTS) return;
    if (!ingredients.some((i) => i.toLowerCase() === name.toLowerCase())) setIngredients([...ingredients, name]);
    setTyped("");
  }

  if (page.total === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-8 text-center">
        <p className="font-heading text-2xl">{t("emptyTitle")}</p>
        <p className="mt-2 text-muted-foreground">{t("emptyBody")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/dishes/new">{t("addDish")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/discover">{t("browseDiscover")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const noIngredients = mode === "ingredients" && ingredients.length === 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <section aria-labelledby="spin-options" className="space-y-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 id="spin-options" className="sr-only">
          {t("optionsHeading")}
        </h2>
        {page.usage ? <TriesMeter usage={page.usage} variant="compact" /> : null}
        <div className="space-y-2">
          <p id="spin-mode" className="text-sm font-medium">
            {t("modeLabel")}
          </p>
          <ToggleGroup
            type="single"
            aria-labelledby="spin-mode"
            value={mode}
            onValueChange={(v) => v && setMode(v as SpinMode)}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="random" className="flex-1">
              {t("random")}
            </ToggleGroupItem>
            <ToggleGroupItem value="ingredients" className="flex-1">
              {t("withIngredients")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {mode === "ingredients" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("ingredientsHint", { max: MAX_INGREDIENTS })}</p>
            {ingredients.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {ingredients.map((name) => (
                  <li key={name}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setIngredients(ingredients.filter((i) => i !== name))}
                    >
                      {name}
                      <XIcon aria-hidden="true" data-icon="inline-end" />
                      <span className="sr-only">{t("removeIngredient", { name })}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {ingredients.length < MAX_INGREDIENTS ? (
              <form onSubmit={addIngredient} className="flex gap-2">
                <Label htmlFor="spin-ingredient" className="sr-only">
                  {t("addIngredientLabel")}
                </Label>
                <Input
                  id="spin-ingredient"
                  value={typed}
                  maxLength={80}
                  placeholder={t("addIngredientPlaceholder")}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={!typed.trim()}>
                  <PlusIcon aria-hidden="true" data-icon="inline-start" />
                  {t("add")}
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        {page.collections.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="spin-collection">{t("collectionLabel")}</Label>
            <NativeSelect
              id="spin-collection"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="">{t("allDishes")}</NativeSelectOption>
              {page.collections.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <Button size="lg" className="w-full" disabled={spinning || noIngredients} onClick={spin}>
          <DicesIcon aria-hidden="true" data-icon="inline-start" />
          {spinning ? t("spinning") : outcome?.kind === "result" ? t("spinAgain") : t("spin")}
        </Button>
        {noIngredients ? <p className="text-sm text-muted-foreground">{t("needIngredients")}</p> : null}

        {page.pickedToday.length > 0 ? (
          <div className="space-y-1 border-t border-border pt-4 text-sm">
            <p className="font-medium">{t("pickedToday")}</p>
            <p className="text-muted-foreground">{page.pickedToday.map((d) => d.name).join(t("listSeparator"))}</p>
            <p className="text-xs text-muted-foreground">{t("noRepeats")}</p>
          </div>
        ) : null}
      </section>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="space-y-4 outline-none">
        {spinning ? (
          <div className="grid place-items-center gap-4 rounded-3xl border border-border bg-card p-10">
            <ZelligeStar className="size-28 motion-safe:animate-[spin_0.9s_cubic-bezier(.4,.1,.3,1)_infinite]" />
            <p className="font-medium">{t("spinning")}</p>
          </div>
        ) : outcome?.kind === "result" ? (
          <div className="space-y-3">
            {outcome.result.matchMode === "any" ? (
              <p className="rounded-2xl bg-secondary p-3 text-sm">{t("anyNote")}</p>
            ) : null}
            <CookCard as="div" dish={outcome.result.dish} rank={0} source="spin" />
            <Button variant="ghost" onClick={() => setOutcome(null)}>
              {t("notNow")}
            </Button>
          </div>
        ) : outcome?.kind === "nothing" ? (
          <div className="space-y-3 rounded-3xl border border-dashed border-border p-6">
            <p className="font-heading text-xl">{t("nothingTitle")}</p>
            <p className="text-muted-foreground">{t("nothingBody")}</p>
            <Button asChild variant="outline">
              <Link href="/assistant">
                <MessageCircleIcon aria-hidden="true" data-icon="inline-start" />
                {t("askAssistant")}
              </Link>
            </Button>
          </div>
        ) : outcome?.kind === "offline" ? (
          <p className="rounded-3xl border border-dashed border-border p-6 text-muted-foreground">{t("offline")}</p>
        ) : (
          <div
            className={cn(
              "grid place-items-center gap-4 rounded-3xl border border-dashed border-border p-10 text-center",
            )}
          >
            <ZelligeStar className="size-24 opacity-80" />
            <p className="max-w-sm text-muted-foreground">{t("idle")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
