"use client";

import { ArrowLeftIcon, ArrowRightIcon, BellRingIcon, CheckIcon, NotebookPenIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { IconButton } from "@/components/feedback/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import type { CookHaveDto } from "@/server/features/cook/dto";
import type { DishDto } from "@/server/features/dishes/dto";

import { useDishCopy } from "@/components/dishes/use-dish-copy";
import { offlineEnabled, readValue, writeValue, type RecipeSnapshot } from "@/components/offline/store";

import { RatingForm } from "./rating-form";
import { alarm, freshTimer, StepTimer, type TimerState } from "./step-timer";
import { useLogCook } from "./use-log-cook";

/** A swipe this far (px) sideways turns the page. */
const SWIPE_PX = 60;

/** Keeps the screen on while cooking, re-asking when the tab comes back (the lock drops when hidden). */
function useWakeLock() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) return void lock.release();
        setHeld(true);
        lock.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
  return held;
}

/**
 * Cooking mode (PRD §3.2): the ingredients, then one step per screen in large
 * text with its timer, then "Log it for today" and a rating. Swipe, tap or
 * use the arrow keys to move; the screen stays awake.
 */
export function CookingMode({ dish, kitchenUsed }: { dish: DishDto; kitchenUsed: CookHaveDto[] }) {
  const { t: tDish, amount } = useDishCopy();
  const t = useTranslations("cooking");
  const rtl = useLocale() === "ar";
  const awake = useWakeLock();
  const { log, pending } = useLogCook();
  const last = dish.steps.length + 1;
  const [screen, setScreen] = useState(0);
  const [timers, setTimers] = useState<Record<number, TimerState>>({});
  const [ringing, setRinging] = useState<number[]>([]);
  const [finished, setFinished] = useState<string[]>([]);
  const [logged, setLogged] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const go = (next: number) => setScreen(Math.min(Math.max(next, 0), last));

  // Today's recipe stays readable on this device without a connection (PRD §4, the offline exception).
  useEffect(() => {
    if (!offlineEnabled()) return;
    void (async () => {
      const owner = await readValue<string>("owner");
      if (!owner) return;
      const recipe: RecipeSnapshot = {
        owner,
        day: new Date().toISOString().slice(0, 10),
        name: dish.name,
        ingredients: dish.ingredients.map((i) =>
          [amount(i.amount, i.unit) ?? tDish("page.toTaste"), i.name, i.note ? `(${i.note})` : ""]
            .filter(Boolean)
            .join(" "),
        ),
        steps: dish.steps.map((step) => step.text),
      };
      await writeValue("recipe", recipe);
    })();
  }, [dish, amount, tDish]);

  // Focus follows the page, so screen readers hear the new step.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [screen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [role=radiogroup]")) return;
      const forward = rtl ? "ArrowLeft" : "ArrowRight";
      const back = rtl ? "ArrowRight" : "ArrowLeft";
      if (event.key === forward) setScreen((s) => Math.min(s + 1, last));
      if (event.key === back) setScreen((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rtl, last]);

  // One clock for every running timer, so a timer on another step still rings.
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      const due = Object.entries(timers).filter(([, s]) => s.endsAt !== null && s.endsAt <= now);
      if (due.length === 0) return;
      alarm();
      setTimers((all) => {
        const next = { ...all };
        for (const [step] of due) next[Number(step)] = { endsAt: null, remainingMs: 0, done: true };
        return next;
      });
      setRinging((list) => [...new Set([...list, ...due.map(([step]) => Number(step))])]);
    }, 500);
    return () => clearInterval(tick);
  }, [timers]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") swipeStart.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    const forward = rtl ? dx > 0 : dx < 0;
    go(screen + (forward ? 1 : -1));
  };

  const step = screen >= 1 && screen <= dish.steps.length ? dish.steps[screen - 1]! : null;
  const label =
    screen === 0
      ? t("ingredientsHeading")
      : screen === last
        ? t("doneHeading")
        : t("stepOf", { step: screen, total: dish.steps.length });

  async function onLog() {
    if (await log(dish, { finished })) setLogged(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={t("title", { name: dish.name })}
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg">{dish.name}</p>
          <p className="text-xs text-muted-foreground">
            {awake ? t("awake") : t("servings", { count: dish.shownServings })}
          </p>
        </div>
        <IconButton label={t("exit")} asChild>
          <Link href={`/dishes/${dish.id}`}>
            <XIcon aria-hidden="true" />
          </Link>
        </IconButton>
      </header>
      <Progress value={(screen / last) * 100} aria-label={label} className="h-1.5 rounded-none" />

      {ringing.length > 0 ? (
        <div role="alert" className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground sm:px-6">
          <BellRingIcon aria-hidden="true" className="size-5 motion-safe:animate-bounce" />
          <p className="flex-1 font-medium">{t("timeUpBanner", { steps: ringing.join(", ") })}</p>
          <Button size="sm" variant="secondary" onClick={() => setRinging([])}>
            {t("dismiss")}
          </Button>
        </div>
      ) : null}

      <main
        className="flex-1 touch-pan-y overflow-y-auto px-4 py-6 sm:px-6 sm:py-10"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <h1 ref={heading} tabIndex={-1} className="text-sm font-medium text-primary-strong outline-none">
            {label}
          </h1>

          {screen === 0 ? (
            <ul className="space-y-3 text-xl sm:text-2xl">
              {dish.ingredients.map((ingredient, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 border-b border-border pb-3">
                  <span className="font-medium tabular-nums">
                    {amount(ingredient.amount, ingredient.unit) ?? tDish("page.toTaste")}
                  </span>
                  <span>{ingredient.name}</span>
                  {ingredient.note ? <span className="text-muted-foreground">({ingredient.note})</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {step ? (
            <div className="space-y-6">
              {step.prepDayBefore ? <Badge variant="secondary">{tDish("page.prepDayBefore")}</Badge> : null}
              <p className="text-2xl leading-relaxed text-pretty sm:text-3xl sm:leading-relaxed">{step.text}</p>
              {step.timerMinutes ? (
                <StepTimer
                  minutes={step.timerMinutes}
                  state={timers[screen] ?? freshTimer(step.timerMinutes)}
                  onChange={(next) => {
                    setTimers((all) => ({ ...all, [screen]: next }));
                    if (next.endsAt !== null) setRinging((list) => list.filter((s) => s !== screen));
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {screen === last ? (
            <div className="space-y-8">
              <p className="font-heading text-3xl">{t("enjoy")}</p>
              {!logged ? (
                <div className="space-y-4">
                  {kitchenUsed.length > 0 ? (
                    <fieldset className="space-y-3">
                      <legend className="font-medium">{t("usedUp")}</legend>
                      <p className="text-sm text-muted-foreground">{t("usedUpHint")}</p>
                      {kitchenUsed.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`used-${item.id}`}
                            checked={finished.includes(item.id)}
                            onCheckedChange={(on) =>
                              setFinished((list) =>
                                on === true ? [...list, item.id] : list.filter((id) => id !== item.id),
                              )
                            }
                          />
                          <Label htmlFor={`used-${item.id}`} className="font-normal">
                            {item.name}
                          </Label>
                        </div>
                      ))}
                    </fieldset>
                  ) : null}
                  <Button size="lg" disabled={pending !== null} onClick={onLog}>
                    {pending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <NotebookPenIcon aria-hidden="true" data-icon="inline-start" />
                    )}
                    {t("logToday")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="flex items-center gap-2 font-medium text-primary-strong">
                    <CheckIcon aria-hidden="true" className="size-5" />
                    {t("loggedNote")}
                  </p>
                  <h2 className="font-heading text-2xl">{t("rateHeading")}</h2>
                  <RatingForm dishId={dish.id} initial={dish.cooking.rating} />
                </div>
              )}
              <Button asChild variant="outline">
                <Link href={`/dishes/${dish.id}`}>{t("backToDish")}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
        <Button variant="ghost" size="lg" disabled={screen === 0} onClick={() => go(screen - 1)}>
          <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" className="rtl:-scale-x-100" />
          {t("back")}
        </Button>
        {screen < last ? (
          <Button size="lg" onClick={() => go(screen + 1)}>
            {screen === dish.steps.length ? t("finish") : t("next")}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" className="rtl:-scale-x-100" />
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
