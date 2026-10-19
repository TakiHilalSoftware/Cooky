import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BlockedPeopleCard } from "@/components/settings/blocked-people-card";
import { getBlockedPeople } from "@/server/features/social/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("privacy") };
}

export default async function PrivacySettingsPage() {
  const blocked = await getBlockedPeople();
  if (!blocked) notFound();
  return (
    <div className="space-y-6">
      <BlockedPeopleCard people={blocked} />
    </div>
  );
}
