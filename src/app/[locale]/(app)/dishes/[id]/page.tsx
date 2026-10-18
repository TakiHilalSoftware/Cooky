import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DishView } from "@/components/dishes/dish-view";
import { getDish } from "@/server/features/dishes/queries";
import { dishIdSchema, servingsParamSchema } from "@/server/features/dishes/schema";

type Props = PageProps<"/[locale]/dishes/[id]">;

async function load({ params, searchParams }: Props) {
  const parsed = dishIdSchema.safeParse(await params);
  if (!parsed.success) return null;
  return getDish(parsed.data.id, servingsParamSchema.parse((await searchParams).servings));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const dish = await load(props);
  return dish ? { title: dish.name } : {};
}

export default async function DishPage(props: Props) {
  const dish = await load(props);
  // Someone else's dish and a missing one look the same: not found.
  if (!dish) notFound();
  return <DishView dish={dish} />;
}
