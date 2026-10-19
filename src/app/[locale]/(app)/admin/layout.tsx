import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { getAdminOverview } from "@/server/features/admin/queries";

/** The admin panel (PRD §3.8). Not an admin: a plain "not found", so the area isn't advertised. */
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const [overview, t] = await Promise.all([getAdminOverview(), getTranslations("admin")]);
  if (!overview) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 font-heading text-4xl">{t("title")}</h1>
      <div className="grid gap-6 lg:grid-cols-[12rem_1fr] lg:gap-10">
        <AdminNav counts={{ reports: overview.openReports, feedback: overview.openFeedback }} />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
