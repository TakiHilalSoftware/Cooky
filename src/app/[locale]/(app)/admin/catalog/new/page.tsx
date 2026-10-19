import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CatalogForm } from "@/components/admin/catalog-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("newTitle") };
}

export default function NewCatalogDishPage() {
  return <CatalogForm />;
}
