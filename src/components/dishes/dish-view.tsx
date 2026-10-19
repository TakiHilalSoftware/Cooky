import { CameraIcon, ChevronLeftIcon, CircleAlertIcon, ExternalLinkIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DishCollections } from "@/components/collections/dish-collections";
import { DishCookingCard } from "@/components/cook/dish-cooking-card";
import { DishSharingCard } from "@/components/social/dish-sharing-card";
import { ReviewsCard } from "@/components/social/reviews-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import type { DishDto } from "@/server/features/dishes/dto";

import { DishActions } from "./dish-actions";
import { DishNoteCard } from "./dish-note-card";
import { FavoriteButton } from "./favorite-button";
import { IngredientsCard, RecipeTags, StepsCard } from "./recipe-parts";
import { useDishCopy } from "./use-dish-copy";

/** The dish page: the recipe scaled to the chosen servings, the steps, nutrition and your notes. */
export function DishView({ dish }: { dish: DishDto }) {
  const { t } = useDishCopy();
  const tCommon = useTranslations("common");
  const tPhotos = useTranslations("photos");

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
            <RecipeTags seasons={dish.seasons} dietaryTags={dish.dietaryTags} />
            {dish.source ? (
              <p className="text-sm">
                <a
                  href={dish.source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("page.source", { site: dish.source.siteName })}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">({tCommon("opensInNewTab")})</span>
                </a>
              </p>
            ) : null}
            {!dish.photo && dish.photosEnabled && !dish.readOnly ? (
              <p className="text-sm">
                <Link
                  href={`/dishes/${dish.id}/edit#dish-photo`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  <CameraIcon aria-hidden="true" className="size-4" />
                  {tPhotos("addToDish")}
                </Link>
              </p>
            ) : null}
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
        {dish.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dish.photo.url}
            alt={dish.name}
            width={1280}
            height={720}
            className="aspect-[16/9] max-h-[28rem] w-full rounded-3xl bg-muted object-cover"
          />
        ) : null}
        {dish.readOnly ? (
          <Alert role="status">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{t("page.readOnly")}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="space-y-6 lg:sticky lg:top-24">
          <IngredientsCard
            ingredients={dish.ingredients}
            servings={dish.servings}
            shownServings={dish.shownServings}
            basePath={`/dishes/${dish.id}`}
          />
          {dish.nutrition ? <Nutrition nutrition={dish.nutrition} /> : null}
        </div>
        <div className="space-y-6">
          <DishCookingCard dish={dish} />
          <StepsCard steps={dish.steps} />
          <DishNoteCard dishId={dish.id} note={dish.note} />
          <DishSharingCard dishId={dish.id} sharing={dish.sharing} />
          {dish.reviews.count > 0 ? <ReviewsCard reviews={dish.reviews} emptyHint={t("page.noReviews")} /> : null}
        </div>
      </div>
    </article>
  );
}

export function Nutrition({ nutrition }: { nutrition: NonNullable<DishDto["nutrition"]> }) {
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
