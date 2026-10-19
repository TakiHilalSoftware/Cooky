import { ListChecksIcon, TimerIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { DishCardDto } from "@/server/features/dishes/dto";

import { FavoriteButton } from "./favorite-button";

/** Tags shown on a card; the rest are counted ("+2"). */
const VISIBLE_TAGS = 2;

/** One dish in My Dishes. The whole card opens the dish; the star works on its own. */
export function DishCard({ dish }: { dish: DishCardDto }) {
  const t = useTranslations("dishes");
  const hiddenTags = dish.dietaryTags.slice(VISIBLE_TAGS).map((tag) => t(`diet.${tag}`));

  return (
    <li className="group relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition-colors focus-within:border-primary-strong hover:border-primary-strong">
      {dish.photoUrl ? (
        // Decorative here: the dish name is the link. A plain <img> because signed URLs change on every render.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.photoUrl}
          alt=""
          width={480}
          height={360}
          loading="lazy"
          className="-mx-1 -mt-1 aspect-[4/3] w-[calc(100%+0.5rem)] max-w-none rounded-2xl bg-muted object-cover"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-primary-strong">
            {t(`course.${dish.course}`)} · {t(`difficulty.${dish.difficulty}`)}
          </p>
          <h2 className="font-heading text-xl leading-snug text-balance break-words">
            {/* Stretched link: the card is one big target, announced by the dish name. */}
            <Link
              href={`/dishes/${dish.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {dish.name}
            </Link>
          </h2>
        </div>
        <FavoriteButton
          dishId={dish.id}
          name={dish.name}
          favorite={dish.favorite}
          className="relative z-10 -me-2 -mt-1"
        />
      </div>
      <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <UsersIcon aria-hidden="true" className="size-4" />
          {t("servingsCount", { count: dish.servings })}
        </li>
        <li className="flex items-center gap-1.5">
          <ListChecksIcon aria-hidden="true" className="size-4" />
          {t("ingredientsCount", { count: dish.ingredientCount })}
        </li>
        {dish.timerMinutes ? (
          <li className="flex items-center gap-1.5">
            <TimerIcon aria-hidden="true" className="size-4" />
            {t("minutes", { count: dish.timerMinutes })}
          </li>
        ) : null}
      </ul>
      {dish.dietaryTags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {dish.dietaryTags.slice(0, VISIBLE_TAGS).map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{t(`diet.${tag}`)}</Badge>
            </li>
          ))}
          {hiddenTags.length > 0 ? (
            <li>
              <Badge variant="outline" title={hiddenTags.join(", ")}>
                +{hiddenTags.length}
                <span className="sr-only">: {hiddenTags.join(", ")}</span>
              </Badge>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}
