import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CatalogForm } from "@/components/admin/catalog-form";
import { getCatalogDishForEdit } from "@/server/features/admin/queries";

type Props = PageProps<"/[locale]/admin/catalog/[id]">;

async function load({ params }: Props) {
  const parsed = z.uuid().safeParse((await params).id);
  return parsed.success ? getCatalogDishForEdit(parsed.data) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const dish = await load(props);
  return dish ? { title: dish.name.en } : {};
}

export default async function EditCatalogDishPage(props: Props) {
  const dish = await load(props);
  if (!dish) notFound();
  // A fresh form per dish, so moving between dishes never carries edits over.
  return <CatalogForm key={dish.id} initial={dish} />;
}
