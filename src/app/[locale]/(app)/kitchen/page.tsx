import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { KitchenView } from "@/components/kitchen/kitchen-view";
import { asAppLocale } from "@/i18n/routing";
import { getReadyToCook } from "@/server/features/cook/queries";
import { getPantry } from "@/server/features/kitchen/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("kitchen");
  return { title: t("title") };
}

export default async function KitchenPage({ params }: PageProps<"/[locale]/kitchen">) {
  const appLocale = asAppLocale((await params).locale);
  const [pantry, ready, t] = await Promise.all([
    getPantry(appLocale),
    getReadyToCook(appLocale),
    getTranslations("kitchen"),
  ]);
  if (!pantry || !ready) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl text-balance">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <KitchenView pantry={pantry} ready={ready} />
    </div>
  );
}
