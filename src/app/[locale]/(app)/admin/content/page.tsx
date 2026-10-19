import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ContentView } from "@/components/admin/moderation-views";
import { contentTabParam, pageParam } from "@/server/features/admin/params";
import { listRecentReviews, listSharedDishes } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("content") };
}

export default async function AdminContentPage({ searchParams }: PageProps<"/[locale]/admin/content">) {
  const sp = await searchParams;
  const tab = contentTabParam.parse(sp.tab);
  const page = pageParam.parse(sp.page);
  if (tab === "reviews") {
    const rows = await listRecentReviews(page);
    if (!rows) notFound();
    return <ContentView tab="reviews" rows={rows} />;
  }
  const rows = await listSharedDishes(page);
  if (!rows) notFound();
  return <ContentView tab="shared" rows={rows} />;
}
