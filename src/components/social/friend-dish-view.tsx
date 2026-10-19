import { ChevronLeftIcon, InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Nutrition } from "@/components/dishes/dish-view";
import { IngredientsCard, RecipeTags, StepsCard } from "@/components/dishes/recipe-parts";
import { Link } from "@/i18n/navigation";
import type { FriendDishDto } from "@/server/features/dishes/dto";

import { FriendDishActions } from "./friend-dish-actions";
import { PersonAvatar } from "./person-avatar";
import { ReviewsCard } from "./reviews-card";

/**
 * A dish a friend shared (PRD §3.6): read-only, scaled like your own. Copy it
 * to cook, plan or rate it; rating your copy rates theirs too.
 */
export function FriendDishView({ dish }: { dish: FriendDishDto }) {
  const t = useTranslations("sharing.friendDish");
  const tDishes = useTranslations("dishes");
  const owner = dish.owner;

  return (
    <article className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-4">
        <Link
          href={`/friends/${owner.id}`}
          className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          {t("back", { name: owner.displayName })}
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium text-primary-strong">
              {tDishes(`course.${dish.course}`)} · {tDishes(`difficulty.${dish.difficulty}`)}
            </p>
            <h1 className="font-heading text-4xl leading-tight text-balance break-words sm:text-5xl rtl:leading-[1.3]">
              {dish.name}
            </h1>
            <Link
              href={`/friends/${owner.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full pe-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <PersonAvatar person={owner} className="size-7" />
              {t("sharedBy", { name: owner.displayName })}
            </Link>
            <RecipeTags seasons={dish.seasons} dietaryTags={dish.dietaryTags} />
          </div>
          <FriendDishActions dishId={dish.id} name={dish.name} myCopyId={dish.myCopyId} />
        </header>
        <p className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {dish.myCopyId ? t("haveCopyHint") : t("copyHint", { name: owner.displayName })}
        </p>
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
          <StepsCard steps={dish.steps} emptyText={t("noSteps", { name: owner.displayName })} />
          <ReviewsCard reviews={dish.reviews} emptyHint={t("noReviews")} />
        </div>
      </div>
    </article>
  );
}
