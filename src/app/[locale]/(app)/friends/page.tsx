import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { FriendsView } from "@/components/social/friends-view";
import { getAccountSummary } from "@/server/features/account/queries";
import { getFriendsPage } from "@/server/features/social/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends");
  return { title: t("title") };
}

export default async function FriendsPage() {
  const [page, account, t] = await Promise.all([getFriendsPage(), getAccountSummary(), getTranslations("friends")]);
  if (!page || !account) notFound();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl text-balance">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <FriendsView page={page} hasNewRequests={account.badges.newRequests > 0} />
    </div>
  );
}
