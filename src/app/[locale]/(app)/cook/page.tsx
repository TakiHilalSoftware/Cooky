import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CookView } from "@/components/cook/cook-view";
import { asAppLocale } from "@/i18n/routing";
import { getCook } from "@/server/features/cook/queries";
import { cookFiltersSchema } from "@/server/features/cook/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cook");
  return { title: t("title") };
}

export default async function CookPage({ params, searchParams }: PageProps<"/[locale]/cook">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const cook = await getCook(cookFiltersSchema.parse(query), asAppLocale(locale));
  if (!cook) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <CookView cook={cook} locale={locale} />
    </div>
  );
}
