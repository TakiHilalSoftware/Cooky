import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TimerPage as TimerView } from "@/components/timer/timer-page";
import { getNotificationSettings } from "@/server/features/social/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("timer");
  return { title: t("title") };
}

export default async function TimerPage() {
  // Settings → Notifications can switch off the "time's up" notification.
  const settings = await getNotificationSettings();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <TimerView notify={!settings?.off.includes("timers")} />
    </div>
  );
}
