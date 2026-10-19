import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AppearanceCard } from "@/components/settings/appearance-card";
import { CalendarFeedCard } from "@/components/settings/calendar-feed-card";
import { KitchenCard } from "@/components/settings/kitchen-card";
import { OfflineCard } from "@/components/settings/offline-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { getCalendarFeed } from "@/server/features/calendar-feed/queries";
import { getKitchen, getProfileSettings } from "@/server/features/profile/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const [profile, kitchen, feed] = await Promise.all([getProfileSettings(), getKitchen(), getCalendarFeed()]);
  // The (app) layout already sent signed-out visitors to log in.
  if (!profile || !kitchen || !feed) notFound();
  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} />
      <KitchenCard kitchen={kitchen} />
      <AppearanceCard initial={{ accent: profile.accent, theme: profile.theme, textSize: profile.textSize }} />
      <CalendarFeedCard feed={feed} />
      <OfflineCard />
    </div>
  );
}
