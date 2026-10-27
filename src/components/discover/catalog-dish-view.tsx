import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DishCover } from "@/components/brand/dish-cover";
import { IngredientsCard, RecipeTags, StepsCard } from "@/components/dishes/recipe-parts";
import { Link } from "@/i18n/navigation";
import type { CatalogDishDto } from "@/server/features/discover/dto";

import { SaveCatalogButton } from "./save-catalog-button";
import { useCountry } from "./use-country";

/** A Discover dish: the recipe, scaled on the server, with "Save to my dishes". */
export function CatalogDishView({ dish }: { dish: CatalogDishDto }) {
  const t = useTranslations();
  const country = useCountry();
  return (
    <article className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-4">
        <Link
          href="/discover"
          className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          {t("discover.back")}
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl min-w-0 space-y-3">
            <p className="text-sm font-medium text-primary-strong">
              {t("discover.fromCountry", { country: country.name(dish.country) })} · {t(`dishes.course.${dish.course}`)}{" "}
              · {t(`dishes.difficulty.${dish.difficulty}`)}
            </p>
            <h1 className="font-heading text-4xl leading-tight text-balance sm:text-5xl rtl:leading-[1.3]">
              {dish.name}
            </h1>
            <p className="text-lg text-pretty text-muted-foreground">{dish.description}</p>
            <RecipeTags seasons={dish.seasons} dietaryTags={dish.dietaryTags} />
          </div>
          <div className="space-y-2">
            <SaveCatalogButton
              slug={dish.slug}
              name={dish.name}
              signedIn={dish.signedIn}
              savedDishId={dish.savedDishId}
            />
            {dish.signedIn && !dish.savedDishId ? (
              <p className="max-w-56 text-xs text-muted-foreground">{t("discover.followsNote")}</p>
            ) : null}
          </div>
        </header>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <DishCover
          photoUrl={dish.photoUrl}
          course={dish.course}
          seed={dish.slug}
          shape="photo"
          eager
          className="max-h-[420px] w-full object-cover"
        />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <IngredientsCard
            ingredients={dish.ingredients}
            servings={dish.servings}
            shownServings={dish.shownServings}
            basePath={`/discover/${dish.slug}`}
          />
        </div>
        <StepsCard steps={dish.steps} />
      </div>
    </article>
  );
}
