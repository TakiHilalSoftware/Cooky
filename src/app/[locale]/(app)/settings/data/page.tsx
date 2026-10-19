import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BackupCard } from "@/components/backup/backup-card";
import { DataExportCard } from "@/components/settings/data-export-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { getYourData } from "@/server/features/account/data";
import { getBackupOverview } from "@/server/features/backup/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backup");
  return { title: t("title") };
}

export default async function DataSettingsPage() {
  const [overview, data, t] = await Promise.all([getBackupOverview(), getYourData(), getTranslations("backup")]);
  // The (app) layout already sent signed-out visitors to log in.
  if (!overview || !data) notFound();
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <BackupCard overview={overview} />
      <DataExportCard data={data.export} />
      <DeleteAccountCard hasPassword={data.hasPassword} />
    </div>
  );
}
