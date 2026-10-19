import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ReportsView } from "@/components/admin/moderation-views";
import { pageParam, reportStatusParam } from "@/server/features/admin/params";
import { listReports } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("reports") };
}

export default async function AdminReportsPage({ searchParams }: PageProps<"/[locale]/admin/reports">) {
  const sp = await searchParams;
  const status = reportStatusParam.parse(sp.status);
  const reports = await listReports(status, pageParam.parse(sp.page));
  if (!reports) notFound();
  return <ReportsView reports={reports} status={status} />;
}
