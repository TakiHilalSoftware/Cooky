import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { NotificationsCard } from "@/components/settings/notifications-card";
import { getNotificationSettings } from "@/server/features/social/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("notifications") };
}

export default async function NotificationSettingsPage() {
  const settings = await getNotificationSettings();
  if (!settings) notFound();
  return <NotificationsCard settings={settings} />;
}
