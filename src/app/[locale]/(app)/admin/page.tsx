import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AdminOverview } from "@/components/admin/admin-overview";
import { getAdminOverview } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();
  if (!overview) notFound();
  return <AdminOverview overview={overview} />;
}
