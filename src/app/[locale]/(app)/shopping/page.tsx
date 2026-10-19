import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ShoppingView } from "@/components/shopping/shopping-view";
import { asAppLocale } from "@/i18n/routing";
import { getShoppingList } from "@/server/features/shopping/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shopping");
  return { title: t("title") };
}

export default async function ShoppingPage({ params }: PageProps<"/[locale]/shopping">) {
  const { locale } = await params;
  const list = await getShoppingList(asAppLocale(locale));
  if (!list) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <ShoppingView list={list} />
    </div>
  );
}
