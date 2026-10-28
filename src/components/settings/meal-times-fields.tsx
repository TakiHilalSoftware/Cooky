"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DAY_ORDER, DEFAULT_MEAL_TIMES, fromClock, toClock, type MealTimes } from "@/lib/meal-times";
import { cn } from "@/lib/utils";

/**
 * When the person usually eats (Settings → Kitchen): a time per meal, or
 * unticked for a meal they don't have. Cook suggests dishes for the next one.
 * A meal ticked off and on again gets its last time back.
 */
export function MealTimesFields({ value, onChange }: { value: MealTimes; onChange: (next: MealTimes) => void }) {
  const t = useTranslations("settings.mealTimes");
  const tSlot = useTranslations("planner.slots");
  const tMeal = useTranslations("cook.meal.names");
  const id = useId();
  const [remembered, setRemembered] = useState<MealTimes>(() => ({
    breakfast: value.breakfast ?? DEFAULT_MEAL_TIMES.breakfast,
    lunch: value.lunch ?? DEFAULT_MEAL_TIMES.lunch,
    snack: value.snack ?? DEFAULT_MEAL_TIMES.snack,
    dinner: value.dinner ?? DEFAULT_MEAL_TIMES.dinner,
  }));
  const none = DAY_ORDER.every((slot) => value[slot] === null);

  return (
    <fieldset id="meal-times" aria-describedby={`${id}-hint`} className="scroll-mt-24 space-y-3">
      <legend className="text-sm font-medium">{t("label")}</legend>
      <p id={`${id}-hint`} className="text-sm text-pretty text-muted-foreground">
        {t("hint")}
      </p>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {DAY_ORDER.map((slot) => {
          const on = value[slot] !== null;
          const name = tSlot(slot);
          return (
            <li key={slot} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={`${id}-${slot}`}
                  checked={on}
                  onCheckedChange={(checked) => onChange({ ...value, [slot]: checked ? remembered[slot] : null })}
                />
                <label htmlFor={`${id}-${slot}`} className="cursor-pointer text-sm font-medium">
                  {name}
                </label>
              </div>
              <label className="flex items-center gap-2">
                <span className="sr-only">{t("timeLabel", { meal: name })}</span>
                <Input
                  type="time"
                  step={300}
                  required={on}
                  disabled={!on}
                  value={toClock(value[slot] ?? remembered[slot] ?? 0)}
                  title={on ? t("timeHint", { meal: tMeal(slot) }) : t("offHint")}
                  // A cleared field keeps the last time: turning a meal off is the checkbox's job.
                  onChange={(e) => {
                    const minutes = fromClock(e.target.value);
                    if (minutes === null) return;
                    setRemembered((r) => ({ ...r, [slot]: minutes }));
                    onChange({ ...value, [slot]: minutes });
                  }}
                  className={cn("h-10 w-32 tabular-nums", !on && "text-muted-foreground")}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {none ? t("allOff") : null}
      </p>
    </fieldset>
  );
}
