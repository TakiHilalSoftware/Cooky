import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AssistantView } from "@/components/assistant/assistant-view";
import { asAppLocale } from "@/i18n/routing";
import { getAssistantPage } from "@/server/features/assistant/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assistant");
  return { title: t("title") };
}

export default async function AssistantPage({ params }: PageProps<"/[locale]/assistant">) {
  const { locale } = await params;
  const page = await getAssistantPage(null, asAppLocale(locale));
  if (!page) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <AssistantView page={page} />
    </div>
  );
}
