import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeHero } from "@/components/marketing/home-hero";
import { routing } from "@/i18n/routing";
import { getAccountSummary } from "@/server/features/account/queries";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <HomeHero signedIn={(await getAccountSummary()) !== null} />;
}
