import { BookmarkCheckIcon, TimerIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DishCover } from "@/components/brand/dish-cover";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CatalogCardDto } from "@/server/features/discover/dto";

import { getCuratedDishPhoto } from "@/lib/curated-dishes";
import { useCountry } from "./use-country";

/** One Discover dish. The whole card opens it. */
export function CatalogCard({ dish, className }: { dish: CatalogCardDto; className?: string }) {
  const t = useTranslations();
  const country = useCountry();
  const photo = getCuratedDishPhoto(dish.slug);
  return (
    <li
      className={cn(
        "group relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition-all duration-300 focus-within:border-primary-strong hover:border-primary-strong hover:shadow-md",
        className,
      )}
    >
      <div className="-mx-1 -mt-1 overflow-hidden rounded-2xl">
        <DishCover
          photoUrl={photo}
          course={dish.course}
          seed={dish.slug}
          shape="photo"
          className="w-full max-w-none transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <p className="text-xs font-medium text-primary-strong">
        {country.name(dish.country)} · {t(`dishes.course.${dish.course}`)}
      </p>
      <h3 className="font-heading text-xl leading-snug text-balance">
        <Link
          href={`/discover/${dish.slug}`}
          className="outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {dish.name}
        </Link>
      </h3>
      <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">{dish.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{t(`dishes.difficulty.${dish.difficulty}`)}</span>
        {dish.timerMinutes ? (
          <span className="flex items-center gap-1">
            <TimerIcon aria-hidden="true" className="size-4" />
            {t("dishes.minutes", { count: dish.timerMinutes })}
          </span>
        ) : null}
        {dish.saved ? (
          <Badge variant="secondary" className="ms-auto">
            <BookmarkCheckIcon aria-hidden="true" />
            {t("discover.inYourDishes")}
          </Badge>
        ) : null}
      </div>
    </li>
  );
}
