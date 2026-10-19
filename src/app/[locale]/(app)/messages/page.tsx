import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ConversationList } from "@/components/messages/conversation-list";
import { getConversations } from "@/server/features/messages/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messages");
  return { title: t("title") };
}

export default async function MessagesPage({ searchParams }: PageProps<"/[locale]/messages">) {
  const showArchived = (await searchParams).archived === "1";
  const [list, t] = await Promise.all([getConversations(showArchived), getTranslations("messages")]);
  if (!list) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl text-balance">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <ConversationList list={list} />
    </div>
  );
}
