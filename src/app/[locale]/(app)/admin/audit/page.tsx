import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AuditView } from "@/components/admin/moderation-views";
import { pageParam, queryParam } from "@/server/features/admin/params";
import { listAudit } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("audit") };
}

export default async function AdminAuditPage({ searchParams }: PageProps<"/[locale]/admin/audit">) {
  const sp = await searchParams;
  const action = queryParam.parse(sp.q);
  const entries = await listAudit(action, pageParam.parse(sp.page));
  if (!entries) notFound();
  return <AuditView entries={entries} action={action} />;
}
