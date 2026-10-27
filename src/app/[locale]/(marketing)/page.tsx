import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeHero } from "@/components/marketing/home-hero";
import { DiscoverPreview, KitchenStoryline, PricingSection } from "@/components/marketing/home-sections";
import { routing } from "@/i18n/routing";
import { getAccountSummary } from "@/server/features/account/queries";
import { getPricing } from "@/server/features/billing/queries";
import { getHomeDishes } from "@/server/features/discover/queries";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [account, dishes, pricing] = await Promise.all([getAccountSummary(), getHomeDishes(locale), getPricing()]);
  const signedIn = account !== null;
  return (
    <HomeHero signedIn={signedIn}>
      <KitchenStoryline signedIn={signedIn} />
      <DiscoverPreview dishes={dishes} />
      <PricingSection pricing={pricing} />
    </HomeHero>
  );
}
