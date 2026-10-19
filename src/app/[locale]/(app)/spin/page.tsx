import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SpinView } from "@/components/spin/spin-view";
import { asAppLocale } from "@/i18n/routing";
import { getSpinPage } from "@/server/features/spin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("spin");
  return { title: t("title") };
}

export default async function SpinPage({ params }: PageProps<"/[locale]/spin">) {
  const { locale } = await params;
  const [page, t] = await Promise.all([getSpinPage(asAppLocale(locale)), getTranslations("spin")]);
  if (!page) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl text-balance">{t("title")}</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <SpinView page={page} />
    </div>
  );
}
