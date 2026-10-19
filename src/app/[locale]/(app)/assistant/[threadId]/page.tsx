import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AssistantView } from "@/components/assistant/assistant-view";
import { asAppLocale } from "@/i18n/routing";
import { getAssistantPage } from "@/server/features/assistant/queries";
import { threadIdSchema } from "@/server/features/assistant/schema";

async function load(params: PageProps<"/[locale]/assistant/[threadId]">["params"]) {
  const { locale, threadId } = await params;
  const parsed = threadIdSchema.safeParse({ id: threadId });
  if (!parsed.success) return null;
  const page = await getAssistantPage(parsed.data.id, asAppLocale(locale));
  // Someone else's (or a deleted) conversation looks the same as a missing one.
  return page?.thread ? page : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/assistant/[threadId]">): Promise<Metadata> {
  const [page, t] = await Promise.all([load(params), getTranslations("assistant")]);
  return { title: page?.thread?.title ?? t("title") };
}

export default async function AssistantThreadPage({ params }: PageProps<"/[locale]/assistant/[threadId]">) {
  const page = await load(params);
  if (!page) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <AssistantView page={page} />
    </div>
  );
}
