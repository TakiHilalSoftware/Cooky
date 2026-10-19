import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogDishView } from "@/components/discover/catalog-dish-view";
import { asAppLocale } from "@/i18n/routing";
import { servingsParamSchema } from "@/server/features/dishes/schema";
import { getCatalogDish } from "@/server/features/discover/queries";
import { catalogSlugSchema } from "@/server/features/discover/schema";

type Props = PageProps<"/[locale]/discover/[slug]">;

async function load({ params, searchParams }: Props) {
  const { locale, ...rest } = await params;
  const parsed = catalogSlugSchema.safeParse(rest);
  if (!parsed.success) return null;
  return getCatalogDish(
    parsed.data.slug,
    asAppLocale(locale),
    servingsParamSchema.parse((await searchParams).servings),
  );
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const dish = await load(props);
  return dish ? { title: dish.name, description: dish.description } : {};
}

export default async function CatalogDishPage(props: Props) {
  const dish = await load(props);
  if (!dish) notFound();
  return <CatalogDishView dish={dish} />;
}
