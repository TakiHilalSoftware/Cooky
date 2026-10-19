import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CatalogList } from "@/components/admin/catalog-list";
import { pageParam, queryParam } from "@/server/features/admin/params";
import { listCatalog } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("catalog") };
}

export default async function AdminCatalogPage({ searchParams }: PageProps<"/[locale]/admin/catalog">) {
  const sp = await searchParams;
  const q = queryParam.parse(sp.q);
  const catalog = await listCatalog(q, pageParam.parse(sp.page));
  if (!catalog) notFound();
  return <CatalogList catalog={catalog} q={q} />;
}
