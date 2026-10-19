import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DiscoverView } from "@/components/discover/discover-view";
import { asAppLocale } from "@/i18n/routing";
import { getDiscover } from "@/server/features/discover/queries";
import { discoverFiltersSchema } from "@/server/features/discover/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("discover");
  return { title: t("title") };
}

export default async function DiscoverPage({ params, searchParams }: PageProps<"/[locale]/discover">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const filters = discoverFiltersSchema.parse(query);
  const data = await getDiscover(filters, asAppLocale(locale));
  return <DiscoverView data={data} filters={filters} />;
}
