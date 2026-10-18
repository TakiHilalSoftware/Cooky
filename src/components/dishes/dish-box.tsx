import { CompassIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { DishListDto } from "@/server/features/dishes/dto";
import type { Course } from "@/lib/dishes";

import { DishCard } from "./dish-card";
import { AddDishButton, DishAllowanceNotice } from "./dish-allowance";
import { DeletedDishUndo } from "./deleted-dish-undo";
import { DishFilters } from "./dish-filters";

type DishBoxProps = {
  list: DishListDto;
  filters: { q?: string; course?: Course; favorites: boolean };
  /** Just deleted from its page: offer Undo. */
  deleted: { id: string; name: string } | null;
};

/** My Dishes: header, how full the box is, filters, and the dishes (or the right empty state). */
export function DishBox({ list, filters, deleted }: DishBoxProps) {
  const t = useTranslations("dishes.list");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {list.total > 0 ? <AddDishButton allowance={list.allowance} /> : null}
      </header>

      {deleted ? <DeletedDishUndo dish={deleted} /> : null}
      <DishAllowanceNotice allowance={list.allowance} />

      {list.total === 0 ? (
        <EmptyState
          headingLevel={2}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={<AddDishButton allowance={list.allowance} />}
        />
      ) : (
        <>
          <DishFilters q={filters.q} course={filters.course} favorites={filters.favorites} />
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t("results", { count: list.dishes.length })}
          </p>
          {list.dishes.length === 0 ? (
            <EmptyState
              headingLevel={2}
              illustration={<CompassIcon aria-hidden="true" className="size-14 text-primary-strong" />}
              title={t("noMatchTitle")}
              description={t("noMatchBody")}
              action={
                <Button asChild variant="outline" size="lg">
                  <Link href="/dishes" replace>
                    <XIcon aria-hidden="true" data-icon="inline-start" />
                    {t("clearFilters")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.dishes.map((dish) => (
                <DishCard key={dish.id} dish={dish} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
