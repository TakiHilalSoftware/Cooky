import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ChangePasswordCard } from "@/components/security/change-password-card";
import { DevicesCard } from "@/components/security/devices-card";
import { PasskeysCard } from "@/components/security/passkeys-card";
import { TwoFactorCard } from "@/components/security/two-factor-card";
import { getSecurityOverview } from "@/server/features/security/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.security");
  return { title: t("title") };
}

export default async function SecuritySettingsPage() {
  const overview = await getSecurityOverview();
  // The (app) layout already sent signed-out visitors to log in.
  if (!overview) notFound();
  const t = await getTranslations("settings.security");
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <ChangePasswordCard hasPassword={overview.hasPassword} />
      {overview.hasPassword ? <TwoFactorCard enabled={overview.twoFactorEnabled} /> : null}
      <PasskeysCard passkeys={overview.passkeys} />
      <DevicesCard devices={overview.devices} />
    </div>
  );
}
