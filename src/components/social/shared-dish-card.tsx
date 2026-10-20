import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DishCover } from "@/components/brand/dish-cover";
import { Link } from "@/i18n/navigation";
import type { SharedDishCardDto } from "@/server/features/social/dto";

/** A dish a friend shared with you. The whole card opens it. */
export function SharedDishCard({ dish }: { dish: SharedDishCardDto }) {
  const t = useTranslations("dishes");
  return (
    <li className="group relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 transition-colors focus-within:border-primary-strong hover:border-primary-strong">
      {/* Decorative: the name is the link. */}
      <DishCover photoUrl={dish.photoUrl} course={dish.course} seed={dish.id} />
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-primary-strong">
          {t(`course.${dish.course}`)} · {t(`difficulty.${dish.difficulty}`)}
        </p>
        <h3 className="font-heading text-lg leading-snug break-words">
          <Link
            href={`/dishes/${dish.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {dish.name}
          </Link>
        </h3>
      </div>
      <p className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
        <UsersIcon aria-hidden="true" className="size-4" />
        {t("servingsCount", { count: dish.servings })}
      </p>
    </li>
  );
}
