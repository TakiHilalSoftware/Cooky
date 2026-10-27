import { BookmarkCheckIcon, HeartIcon, RefrigeratorIcon, TimerIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DishCover } from "@/components/brand/dish-cover";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CatalogCardDto, SuggestionReason } from "@/server/features/discover/dto";

/** Why this dish was picked for them, in one line. */
function ReasonLine({ reason }: { reason: SuggestionReason }) {
  const t = useTranslations("discover.reason");
  const format = useFormatter();
  const Icon = reason.kind === "have" ? RefrigeratorIcon : HeartIcon;
  const text =
    reason.kind === "have" ? t("have", { names: format.list(reason.names, { type: "conjunction" }) }) : t("country");
  return (
    <p className="flex items-start gap-1.5 text-sm font-medium text-pretty text-primary-strong">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="line-clamp-2">{text}</span>
    </p>
  );
}

/**
 * One Discover dish. The whole card opens it. `countryName` comes from the
 * server (Intl region names differ between Node and browsers).
 */
export function CatalogCard({
  dish,
  countryName,
  reason,
  className,
}: {
  dish: CatalogCardDto;
  countryName: string;
  reason?: SuggestionReason | null;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <li
      className={cn(
        "group relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition-all duration-300 focus-within:border-primary-strong hover:border-primary-strong hover:shadow-md motion-reduce:transition-none",
        className,
      )}
    >
      <div className="-mx-1 -mt-1 overflow-hidden rounded-2xl">
        <DishCover
          photoUrl={dish.photoUrl}
          course={dish.course}
          seed={dish.slug}
          shape="photo"
          className="w-full max-w-none transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>
      <p className="text-xs font-medium text-primary-strong">
        {countryName} · {t(`dishes.course.${dish.course}`)}
      </p>
      <h3 className="font-heading text-xl leading-snug text-balance">
        <Link
          href={`/discover/${dish.slug}`}
          className="outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {dish.name}
        </Link>
      </h3>
      {reason ? <ReasonLine reason={reason} /> : null}
      <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">{dish.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{t(`dishes.difficulty.${dish.difficulty}`)}</span>
        {dish.timerMinutes ? (
          <span className="flex items-center gap-1" title={t("discover.timerHint")}>
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
