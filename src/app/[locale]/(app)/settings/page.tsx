import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsSection } from "@/components/settings/settings-section";
import { getAccountSummary } from "@/server/features/account/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const account = await getAccountSummary();
  return <SettingsSection title={t("accountHeading")} description={t("signedInAs", { email: account?.email ?? "" })} />;
}
