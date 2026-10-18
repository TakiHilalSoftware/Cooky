import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BackupCard } from "@/components/backup/backup-card";
import { getBackupOverview } from "@/server/features/backup/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backup");
  return { title: t("title") };
}

export default async function DataSettingsPage() {
  const [overview, t] = await Promise.all([getBackupOverview(), getTranslations("backup")]);
  // The (app) layout already sent signed-out visitors to log in.
  if (!overview) notFound();
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <BackupCard overview={overview} />
    </div>
  );
}
