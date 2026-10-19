import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FeedbackCard } from "@/components/settings/feedback-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.nav");
  return { title: t("help") };
}

export default function HelpSettingsPage() {
  return (
    <div className="space-y-6">
      <FeedbackCard />
    </div>
  );
}
