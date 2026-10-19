"use client";

import { ChefHatIcon, NotebookPenIcon, ShoppingBasketIcon, StarIcon } from "lucide-react";
import { useNow, useTimeZone, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Link, useRouter } from "@/i18n/navigation";
import { addToShopping } from "@/server/actions/shopping";
import { dayIn, daysBetween } from "@/lib/dates";
import type { DishDto } from "@/server/features/dishes/dto";

import { RatingForm } from "./rating-form";
import { useLogCook } from "./use-log-cook";

/** On the dish page: start cooking, log it, your history and your rating (only after cooking it). */
export function DishCookingCard({ dish }: { dish: DishDto }) {
  const t = useTranslations("cook");
  const tRating = useTranslations("rating");
  const timeZone = useTimeZone() ?? "UTC";
  const now = useNow();
  const { log, pending } = useLogCook();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const messages = useFormMessages();
  const router = useRouter();

  async function addToList() {
    setAdding(true);
    const result = await addToShopping({ source: "dish", id: dish.id, servings: dish.shownServings });
    setAdding(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(t("addedToShopping", { count: result.data.added }), {
      action: { label: t("openList"), onClick: () => router.push("/shopping") },
    });
  }
  const { cooking } = dish;

  return (
    <section aria-labelledby="dish-cooking" className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 id="dish-cooking" className="font-heading text-xl">
        {t("dishHeading")}
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link
            href={`/dishes/${dish.id}/cook${dish.shownServings !== dish.servings ? `?servings=${dish.shownServings}` : ""}`}
          >
            <ChefHatIcon aria-hidden="true" data-icon="inline-start" />
            {t("startCooking")}
          </Link>
        </Button>
        <Button variant="outline" disabled={pending !== null} onClick={() => log(dish)}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <NotebookPenIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {t("logToday")}
        </Button>
        <Button variant="ghost" disabled={adding} onClick={addToList}>
          {adding ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ShoppingBasketIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {t("addToShopping")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {cooking.lastCooked
          ? t("history", {
              count: cooking.timesCooked,
              days: daysBetween(cooking.lastCooked, dayIn(timeZone, now)),
            })
          : t("neverCookedLong")}
      </p>
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-medium">{tRating("heading")}</h3>
        {!cooking.canRate ? (
          <p className="text-sm text-muted-foreground">{tRating("afterCooking")}</p>
        ) : cooking.rating && !editing ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1" aria-label={tRating("stars", { count: cooking.rating.stars })}>
              {[1, 2, 3, 4, 5].map((v) => (
                <StarIcon
                  key={v}
                  aria-hidden="true"
                  className={
                    v <= cooking.rating!.stars
                      ? "size-5 fill-primary text-primary-strong"
                      : "size-5 text-muted-foreground"
                  }
                />
              ))}
            </p>
            {cooking.rating.review ? <p className="text-pretty whitespace-pre-line">{cooking.rating.review}</p> : null}
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {tRating("change")}
            </Button>
          </div>
        ) : (
          <RatingForm dishId={dish.id} initial={cooking.rating} onSaved={() => setEditing(false)} />
        )}
      </div>
    </section>
  );
}
