import { CalendarClockIcon, TimerIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { DietaryTag, Season } from "@/lib/dishes";
import { cn } from "@/lib/utils";
import type { IngredientDto, StepDto } from "@/server/features/dishes/dto";

import { ServingsStepper } from "./servings-stepper";
import { useDishCopy } from "./use-dish-copy";

// The parts of a recipe page shared by My Dishes and Discover.

/** Seasons and diet, as labelled badges. */
export function RecipeTags({ seasons, dietaryTags }: { seasons: Season[]; dietaryTags: DietaryTag[] }) {
  const t = useTranslations("dishes");
  if (seasons.length === 0 && dietaryTags.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {seasons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">{t("page.seasonsLabel")}</dt>
          {seasons.map((s) => (
            <dd key={s}>
              <Badge variant="outline">{t(`season.${s}`)}</Badge>
            </dd>
          ))}
        </div>
      ) : null}
      {dietaryTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">{t("page.dietLabel")}</dt>
          {dietaryTags.map((d) => (
            <dd key={d}>
              <Badge variant="secondary">{t(`diet.${d}`)}</Badge>
            </dd>
          ))}
        </div>
      ) : null}
    </dl>
  );
}

type IngredientsCardProps = {
  ingredients: IngredientDto[];
  /** What the recipe is written for, and what it's shown for. */
  servings: number;
  shownServings: number;
  /** The page the servings links point at ("/dishes/…" or "/discover/…"). */
  basePath: string;
};

/** Ingredients scaled by the server, with the servings stepper. */
export function IngredientsCard({ ingredients, servings, shownServings, basePath }: IngredientsCardProps) {
  const { t, amount } = useDishCopy();
  const scaled = shownServings !== servings;

  return (
    <section aria-labelledby="ingredients-heading" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ingredients-heading" className="font-heading text-2xl">
          {t("page.ingredients")}
        </h2>
        <ServingsStepper basePath={basePath} servings={shownServings} />
      </div>
      {scaled ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {t("page.scaledFrom", { count: servings })}
          <Link
            href={basePath}
            replace
            scroll={false}
            className="font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            {t("page.resetServings", { count: servings })}
          </Link>
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-border">
        {ingredients.map((ingredient, index) => {
          const quantity = amount(ingredient.amount, ingredient.unit);
          return (
            <li key={index} className="flex gap-3 py-2.5">
              <span className={cn("w-24 shrink-0 font-medium tabular-nums", !quantity && "text-muted-foreground")}>
                {quantity ?? t("page.toTaste")}
              </span>
              <span className="min-w-0 break-words">
                {ingredient.name}
                {ingredient.note ? <span className="text-muted-foreground">, {ingredient.note}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Numbered steps with their timers and "prep the day before". */
export function StepsCard({ steps, emptyText }: { steps: StepDto[]; emptyText?: string }) {
  const t = useTranslations("dishes");
  return (
    <section aria-labelledby="steps-heading" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 id="steps-heading" className="font-heading text-2xl">
        {t("page.steps")}
      </h2>
      {steps.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{emptyText ?? t("page.noSteps")}</p>
      ) : (
        <ol className="mt-4 space-y-5">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-sm"
              >
                {index + 1}
              </span>
              <div className="min-w-0 space-y-2 pt-1">
                <p className="text-pretty break-words whitespace-pre-line">{step.text}</p>
                {step.timerMinutes || step.prepDayBefore ? (
                  <ul className="flex flex-wrap gap-2">
                    {step.timerMinutes ? (
                      <li>
                        <Badge variant="outline">
                          <TimerIcon aria-hidden="true" />
                          {t("page.timer", { count: step.timerMinutes })}
                        </Badge>
                      </li>
                    ) : null}
                    {step.prepDayBefore ? (
                      <li>
                        <Badge variant="secondary">
                          <CalendarClockIcon aria-hidden="true" />
                          {t("page.prepDayBefore")}
                        </Badge>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
