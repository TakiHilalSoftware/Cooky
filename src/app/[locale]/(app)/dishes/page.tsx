import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DishBox } from "@/components/dishes/dish-box";
import { FirstWeekChecklist } from "@/components/onboarding/first-week-checklist";
import { asAppLocale } from "@/i18n/routing";
import { getChecklist } from "@/server/features/checklist/queries";
import { getDeletedDish, listMyDishes } from "@/server/features/dishes/queries";
import { getKitchen } from "@/server/features/profile/queries";
import { dishListFiltersSchema } from "@/server/features/dishes/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dishes.list");
  return { title: t("title") };
}

export default async function DishesPage({ params, searchParams }: PageProps<"/[locale]/dishes">) {
  const [{ locale }, filters] = await Promise.all([params, searchParams.then((sp) => dishListFiltersSchema.parse(sp))]);
  const [list, deleted, kitchen, checklist] = await Promise.all([
    listMyDishes(filters, asAppLocale(locale)),
    filters.deleted ? getDeletedDish(filters.deleted) : null,
    getKitchen(),
    getChecklist(),
  ]);
  // The (app) layout already sent signed-out visitors to log in.
  if (!list) notFound();
  return (
    <DishBox
      list={list}
      filters={filters}
      deleted={deleted}
      showSetup={kitchen ? !kitchen.onboarded : false}
      checklist={checklist ? <FirstWeekChecklist checklist={checklist} /> : null}
    />
  );
}
