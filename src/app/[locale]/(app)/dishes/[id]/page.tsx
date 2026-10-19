import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DishView } from "@/components/dishes/dish-view";
import { FriendDishView } from "@/components/social/friend-dish-view";
import { asAppLocale } from "@/i18n/routing";
import { getDish, getFriendDish } from "@/server/features/dishes/queries";
import { dishIdSchema, servingsParamSchema } from "@/server/features/dishes/schema";

type Props = PageProps<"/[locale]/dishes/[id]">;

async function load({ params, searchParams }: Props) {
  const { locale, ...rest } = await params;
  const parsed = dishIdSchema.safeParse(rest);
  if (!parsed.success) return null;
  const servings = servingsParamSchema.parse((await searchParams).servings);
  const own = await getDish(parsed.data.id, servings, asAppLocale(locale));
  if (own) return { kind: "own" as const, dish: own };
  // Not yours: maybe a friend shared it with you (read-only).
  const shared = await getFriendDish(parsed.data.id, servings, asAppLocale(locale));
  return shared ? { kind: "friend" as const, dish: shared } : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const found = await load(props);
  return found ? { title: found.dish.name } : {};
}

export default async function DishPage(props: Props) {
  const found = await load(props);
  // A dish nobody shared with you and a missing one look the same: not found.
  if (!found) notFound();
  return found.kind === "own" ? <DishView dish={found.dish} /> : <FriendDishView dish={found.dish} />;
}
