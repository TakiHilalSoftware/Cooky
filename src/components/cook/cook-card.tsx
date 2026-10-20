"use client";

import { CheckCircle2Icon, ChefHatIcon, CloudSunIcon, LeafIcon, NotebookPenIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DishCover } from "@/components/brand/dish-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import type { CookSource } from "@/lib/dishes";
import type { CookCardDto } from "@/server/features/cook/dto";

import { useLogCook } from "./use-log-cook";

/** One ranked dish: ready or what's missing, why it's up here, and the next steps. */
export function CookCard({
  dish,
  rank,
  source = "cook",
  as: Item = "li",
}: {
  dish: CookCardDto;
  rank: number;
  /** Where a "Log it" comes from, for the cook log. */
  source?: CookSource;
  as?: "li" | "div";
}) {
  const t = useTranslations("cook");
  const tDishes = useTranslations("dishes");
  const { log, pending } = useLogCook();
  const ready = dish.missing.length === 0;

  return (
    <Item className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <DishCover
        photoUrl={dish.photoUrl}
        course={dish.course}
        seed={dish.id}
        eager={rank < 3}
        className="rounded-none"
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-primary-strong">{tDishes(`course.${dish.course}`)}</p>
          <h2 className="font-heading text-xl leading-snug break-words">
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
          <Button size="sm" variant="outline" disabled={pending === dish.id} onClick={() => log(dish, { source })}>
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
