import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AppearanceCard } from "@/components/settings/appearance-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { getProfileSettings } from "@/server/features/profile/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const profile = await getProfileSettings();
  // The (app) layout already sent signed-out visitors to log in.
  if (!profile) notFound();
  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} />
      <AppearanceCard initial={{ accent: profile.accent, theme: profile.theme, textSize: profile.textSize }} />
    </div>
  );
}
