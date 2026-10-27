import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { asAppLocale } from "@/i18n/routing";
import { getStarterDishes } from "@/server/features/discover/queries";
import { getPantry } from "@/server/features/kitchen/queries";
import { getKitchen } from "@/server/features/profile/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage({ params, searchParams }: PageProps<"/[locale]/onboarding">) {
  const [{ locale }, { step }] = await Promise.all([params, searchParams]);
  const appLocale = asAppLocale(locale);
  const [kitchen, dishes, pantry] = await Promise.all([
    getKitchen(),
    getStarterDishes(appLocale),
    getPantry(appLocale),
  ]);
  if (!kitchen || !pantry) notFound();
  return (
    <OnboardingWizard
      kitchen={kitchen}
      dishes={dishes}
      staples={pantry.suggestedStaples}
      initialStep={Number(step) || 0}
    />
  );
}
