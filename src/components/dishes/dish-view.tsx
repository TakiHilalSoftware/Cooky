import { CalendarClockIcon, ChevronLeftIcon, CircleAlertIcon, TimerIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DishCollections } from "@/components/collections/dish-collections";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { DishDto } from "@/server/features/dishes/dto";

import { DishActions } from "./dish-actions";
import { DishNoteCard } from "./dish-note-card";
import { FavoriteButton } from "./favorite-button";
import { ServingsStepper } from "./servings-stepper";
import { useDishCopy } from "./use-dish-copy";

/** The dish page: the recipe scaled to the chosen servings, the steps, nutrition and your notes. */
export function DishView({ dish }: { dish: DishDto }) {
  const { t } = useDishCopy();

  return (
    <article className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-4">
        <Link
          href="/dishes"
          className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          {t("page.back")}
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium text-primary-strong">
              {t(`course.${dish.course}`)} · {t(`difficulty.${dish.difficulty}`)}
            </p>
            <div className="flex items-start gap-2">
              <h1 className="font-heading text-4xl leading-tight text-balance break-words sm:text-5xl rtl:leading-[1.3]">
                {dish.name}
              </h1>
              <FavoriteButton dishId={dish.id} name={dish.name} favorite={dish.favorite} className="mt-1 shrink-0" />
            </div>
            <Tags dish={dish} />
            <DishCollections
              dishId={dish.id}
              dishName={dish.name}
              collectionIds={dish.collectionIds}
              collections={dish.collections}
              allowance={dish.collectionAllowance}
            />
          </div>
          <DishActions dishId={dish.id} readOnly={dish.readOnly} />
        </header>
        {dish.readOnly ? (
          <Alert role="status">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{t("page.readOnly")}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="space-y-6 lg:sticky lg:top-24">
          <Ingredients dish={dish} />
          {dish.nutrition ? <Nutrition nutrition={dish.nutrition} /> : null}
        </div>
        <div className="space-y-6">
          <Steps dish={dish} />
          <DishNoteCard dishId={dish.id} note={dish.note} />
        </div>
      </div>
    </article>
  );
}

function Tags({ dish }: { dish: DishDto }) {
  const t = useTranslations("dishes");
  if (dish.seasons.length === 0 && dish.dietaryTags.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {dish.seasons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">{t("page.seasonsLabel")}</dt>
          {dish.seasons.map((s) => (
            <dd key={s}>
              <Badge variant="outline">{t(`season.${s}`)}</Badge>
            </dd>
          ))}
        </div>
      ) : null}
      {dish.dietaryTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">{t("page.dietLabel")}</dt>
          {dish.dietaryTags.map((d) => (
            <dd key={d}>
              <Badge variant="secondary">{t(`diet.${d}`)}</Badge>
            </dd>
          ))}
        </div>
      ) : null}
    </dl>
  );
}

function Ingredients({ dish }: { dish: DishDto }) {
  const { t, amount } = useDishCopy();
  const scaled = dish.shownServings !== dish.servings;

  return (
    <section aria-labelledby="ingredients-heading" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ingredients-heading" className="font-heading text-2xl">
          {t("page.ingredients")}
        </h2>
        <ServingsStepper dishId={dish.id} servings={dish.shownServings} />
      </div>
      {scaled ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {t("page.scaledFrom", { count: dish.servings })}
          <Link
            href={`/dishes/${dish.id}`}
            replace
            scroll={false}
            className="font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            {t("page.resetServings", { count: dish.servings })}
          </Link>
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-border">
        {dish.ingredients.map((ingredient, index) => {
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

function Steps({ dish }: { dish: DishDto }) {
  const t = useTranslations("dishes");
  return (
    <section aria-labelledby="steps-heading" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 id="steps-heading" className="font-heading text-2xl">
        {t("page.steps")}
      </h2>
      {dish.steps.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{t("page.noSteps")}</p>
      ) : (
        <ol className="mt-4 space-y-5">
          {dish.steps.map((step, index) => (
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

function Nutrition({ nutrition }: { nutrition: NonNullable<DishDto["nutrition"]> }) {
  const t = useTranslations("dishes.page");
  const format = useFormatter();
  const macros = [
    { key: "protein", value: nutrition.proteinG },
    { key: "carbs", value: nutrition.carbsG },
    { key: "fat", value: nutrition.fatG },
  ] as const;
  return (
    <section aria-labelledby="nutrition-heading" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 id="nutrition-heading" className="font-heading text-xl">
        {t("nutrition")}
      </h2>
      {nutrition.caloriesKcal !== null ? (
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {t("calories", { count: format.number(nutrition.caloriesKcal) })}
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {macros.map(({ key, value }) => (
          <div key={key} className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{t(key)}</dt>
            <dd className="font-medium tabular-nums">
              {value === null ? "—" : t("grams", { count: format.number(value, { maximumFractionDigits: 1 }) })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
