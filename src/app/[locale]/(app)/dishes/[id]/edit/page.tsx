import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DishFormPage } from "@/components/dishes/dish-form-page";
import { NewDishBlocked } from "@/components/dishes/new-dish-blocked";
import { getDishForEdit, getMyDishAllowance } from "@/server/features/dishes/queries";
import { dishIdSchema } from "@/server/features/dishes/schema";

async function load(params: PageProps<"/[locale]/dishes/[id]/edit">["params"]) {
  const parsed = dishIdSchema.safeParse(await params);
  return parsed.success ? getDishForEdit(parsed.data.id) : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/dishes/[id]/edit">): Promise<Metadata> {
  const [dish, t] = await Promise.all([load(params), getTranslations("dishes.form")]);
  return { title: dish ? t("editTitle", { name: dish.name }) : t("newTitle") };
}

export default async function EditDishPage({ params }: PageProps<"/[locale]/dishes/[id]/edit">) {
  const [dish, allowance] = await Promise.all([load(params), getMyDishAllowance()]);
  if (!dish || !allowance) notFound();
  // Over the plan's limit after a downgrade: editing is paused (PRD §3.7).
  if (allowance.readOnly) return <NewDishBlocked allowance={allowance} />;
  return <DishFormPage dish={dish} />;
}
