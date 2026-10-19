import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CookingMode } from "@/components/cook/cooking-mode";
import { asAppLocale } from "@/i18n/routing";
import { getKitchenUsedBy } from "@/server/features/cook/queries";
import { getDish } from "@/server/features/dishes/queries";
import { dishIdSchema, servingsParamSchema } from "@/server/features/dishes/schema";

async function load({ params, searchParams }: PageProps<"/[locale]/dishes/[id]/cook">) {
  const [{ locale, ...rest }, query] = await Promise.all([params, searchParams]);
  const parsed = dishIdSchema.safeParse(rest);
  if (!parsed.success) return null;
  const appLocale = asAppLocale(locale);
  const [dish, kitchenUsed] = await Promise.all([
    getDish(parsed.data.id, servingsParamSchema.parse(query.servings), appLocale),
    getKitchenUsedBy(parsed.data.id, appLocale),
  ]);
  return dish ? { dish, kitchenUsed } : null;
}

export async function generateMetadata(props: PageProps<"/[locale]/dishes/[id]/cook">): Promise<Metadata> {
  const [loaded, t] = await Promise.all([load(props), getTranslations("cooking")]);
  return { title: loaded ? t("title", { name: loaded.dish.name }) : t("fallbackTitle") };
}

export default async function CookingModePage(props: PageProps<"/[locale]/dishes/[id]/cook">) {
  const loaded = await load(props);
  if (!loaded) notFound();
  return <CookingMode dish={loaded.dish} kitchenUsed={loaded.kitchenUsed} />;
}
