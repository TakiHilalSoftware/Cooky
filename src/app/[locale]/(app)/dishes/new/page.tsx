import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DishFormPage } from "@/components/dishes/dish-form-page";
import { NewDishBlocked } from "@/components/dishes/new-dish-blocked";
import { getMyDishAllowance } from "@/server/features/dishes/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dishes.form");
  return { title: t("newTitle") };
}

export default async function NewDishPage() {
  const allowance = await getMyDishAllowance();
  if (!allowance) notFound();
  if (!allowance.canAdd) return <NewDishBlocked allowance={allowance} />;
  return <DishFormPage />;
}
