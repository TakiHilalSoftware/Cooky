import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DishBox } from "@/components/dishes/dish-box";
import { getDeletedDish, listMyDishes } from "@/server/features/dishes/queries";
import { dishListFiltersSchema } from "@/server/features/dishes/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dishes.list");
  return { title: t("title") };
}

export default async function DishesPage({ searchParams }: PageProps<"/[locale]/dishes">) {
  const filters = dishListFiltersSchema.parse(await searchParams);
  const [list, deleted] = await Promise.all([
    listMyDishes(filters),
    filters.deleted ? getDeletedDish(filters.deleted) : null,
  ]);
  // The (app) layout already sent signed-out visitors to log in.
  if (!list) notFound();
  return <DishBox list={list} filters={filters} deleted={deleted} />;
}
