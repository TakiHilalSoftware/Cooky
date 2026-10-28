"use client";

import {
  CalendarCheckIcon,
  CheckCircle2Icon,
  ChefHatIcon,
  CloudSunIcon,
  LeafIcon,
  NotebookPenIcon,
  RepeatIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { DishCover } from "@/components/brand/dish-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CookSource } from "@/lib/dishes";
import type { CookCardDto, CookMealDto } from "@/server/features/cook/dto";

import { useLogCook } from "./use-log-cook";

/** One ranked dish: ready or what's missing, why it's up here, and the next steps. */
export function CookCard({
  dish,
  rank,
  source = "cook",
  as: Item = "li",
  meal = null,
  featured = false,
}: {
  dish: CookCardDto;
  rank: number;
  /** The meal Cook suggests for: names the planned/usual badges and what "Log it" records. */
  meal?: CookMealDto | null;
  /** Where a "Log it" comes from, for the cook log. */
  source?: CookSource;
  as?: "li" | "div";
  /** Cook's top pick for the meal: wide, photo beside the details, marked as the pick. */
  featured?: boolean;
}) {
  const t = useTranslations("cook");
  const tDishes = useTranslations("dishes");
  const tMeal = useTranslations("cook.meal.names");
  const mealName = meal ? tMeal(meal.slot) : null;
  const { log, pending } = useLogCook();
  const ready = dish.missing.length === 0;

  return (
    <Item
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border border-border bg-card",
        featured && "border-primary/40 shadow-lg shadow-primary/5 sm:flex-row",
      )}
    >
      {featured ? (
        // Beside the details, the photo fills the card's height (set by the text) instead of setting it.
        <div className="relative sm:w-72 sm:shrink-0 lg:w-96">
          <DishCover
            photoUrl={dish.photoUrl}
            course={dish.course}
            seed={dish.id}
            eager
            shape="photo"
            className="rounded-none sm:absolute sm:inset-0 sm:aspect-auto sm:size-full"
          />
        </div>
      ) : (
        <DishCover
          photoUrl={dish.photoUrl}
          course={dish.course}
          seed={dish.id}
          eager={rank < 3}
          className="rounded-none"
        />
      )}
      <div className={cn("flex flex-1 flex-col gap-3 p-5", featured && "sm:p-6")}>
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-primary-strong">{tDishes(`course.${dish.course}`)}</p>
          <h2 className={cn("font-heading text-xl leading-snug break-words", featured && "text-2xl sm:text-3xl")}>
            <Link href={`/dishes/${dish.id}`} className="underline-offset-4 hover:underline">
              {dish.name}
            </Link>
          </h2>
        </div>
        {ready ? (
          <p className="flex items-center gap-1.5 font-medium text-primary-strong">
            <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0" />
            {t("ready")}
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-medium">{t("missingCount", { count: dish.missing.length })}</span>{" "}
            <span className="text-muted-foreground">{dish.missing.join(t("listSeparator"))}</span>
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5">
          {featured && mealName ? (
            <li>
              <Badge variant="outline" className="border-primary/50" title={t("topPickHint", { meal: mealName })}>
                <SparklesIcon aria-hidden="true" />
                {t("topPick", { meal: mealName })}
              </Badge>
            </li>
          ) : null}
          {dish.planned && mealName ? (
            <li>
              <Badge title={t("plannedHint", { meal: mealName })}>
                <CalendarCheckIcon aria-hidden="true" />
                {t("planned", { meal: mealName })}
              </Badge>
            </li>
          ) : null}
          {dish.usualCount > 0 && mealName ? (
            <li>
              <Badge variant="secondary" title={t("usualHint", { meal: mealName, count: dish.usualCount })}>
                <RepeatIcon aria-hidden="true" />
                {t("usual", { meal: mealName })}
              </Badge>
            </li>
          ) : null}
          {dish.weatherFit ? (
            <li>
              <Badge variant="secondary" title={t("weatherFitHint")}>
                <CloudSunIcon aria-hidden="true" />
                {t("weatherFit")}
              </Badge>
            </li>
          ) : null}
          {dish.dietFit ? null : (
            <li>
              <Badge variant="outline" title={t("dietMismatchHint")}>
                <LeafIcon aria-hidden="true" />
                {t("dietMismatch")}
              </Badge>
            </li>
          )}
          <li>
            <Badge variant="outline">
              {dish.daysSinceCooked === null ? t("neverCooked") : t("cookedAgo", { days: dish.daysSinceCooked })}
            </Badge>
          </li>
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <Link href={`/dishes/${dish.id}/cook`}>
              <ChefHatIcon aria-hidden="true" data-icon="inline-start" />
              {t("startCooking")}
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending === dish.id}
            title={meal?.logAs ? t("logForHint", { meal: tMeal(meal.logAs) }) : undefined}
            onClick={() => log(dish, { source, mealSlot: meal?.logAs ?? null })}
          >
            {pending === dish.id ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <NotebookPenIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {t("logToday")}
          </Button>
        </div>
      </div>
    </Item>
  );
}
