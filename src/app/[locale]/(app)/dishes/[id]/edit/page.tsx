import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DishFormPage } from "@/components/dishes/dish-form-page";
import { asAppLocale } from "@/i18n/routing";
import { NewDishBlocked } from "@/components/dishes/new-dish-blocked";
import { getFeatureUsage } from "@/server/features/billing/queries";
import { getDishForEdit, getDishPhotoSlot, getMyDishAllowance } from "@/server/features/dishes/queries";
import { dishIdSchema } from "@/server/features/dishes/schema";

async function dishId(params: PageProps<"/[locale]/dishes/[id]/edit">["params"]) {
  const { locale, ...rest } = await params;
  const parsed = dishIdSchema.safeParse(rest);
  return parsed.success ? { id: parsed.data.id, locale: asAppLocale(locale) } : null;
}

async function load(params: PageProps<"/[locale]/dishes/[id]/edit">["params"]) {
  const target = await dishId(params);
  return target ? getDishForEdit(target.id, target.locale) : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/dishes/[id]/edit">): Promise<Metadata> {
  const [dish, t] = await Promise.all([load(params), getTranslations("dishes.form")]);
  return { title: dish ? t("editTitle", { name: dish.name }) : t("newTitle") };
}

export default async function EditDishPage({ params }: PageProps<"/[locale]/dishes/[id]/edit">) {
  const target = await dishId(params);
  const [dish, photo, allowance, voiceUsage] = await Promise.all([
    target ? getDishForEdit(target.id, target.locale) : null,
    target ? getDishPhotoSlot(target.id) : null,
    getMyDishAllowance(),
    getFeatureUsage("voice"),
  ]);
  if (!dish || !allowance) notFound();
  // Over the plan's limit after a downgrade: editing is paused (PRD §3.7).
  if (allowance.readOnly) return <NewDishBlocked allowance={allowance} />;
  return <DishFormPage dish={dish} photo={photo} voiceUsage={voiceUsage} />;
}
