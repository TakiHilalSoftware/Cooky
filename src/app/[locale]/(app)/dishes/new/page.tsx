import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DishFormPage } from "@/components/dishes/dish-form-page";
import { NewDishBlocked } from "@/components/dishes/new-dish-blocked";
import { NewDishFlow } from "@/components/dishes/new-dish-flow";
import { getFeatureUsage } from "@/server/features/billing/queries";
import { getMyDishAllowance } from "@/server/features/dishes/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dishes.form");
  return { title: t("newTitle") };
}

const LINK = /https?:\/\/\S+/;

/** A link shared to Cooky arrives as ?url= or inside ?text= (PWA share target). It's pre-filled, never auto-imported. */
function sharedLink(params: { url?: string | string[]; text?: string | string[] }): string | undefined {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const candidate = pick(params.url) ?? pick(params.text)?.match(LINK)?.[0];
  return candidate && LINK.test(candidate) ? candidate.slice(0, 2000) : undefined;
}

export default async function NewDishPage({ searchParams }: PageProps<"/[locale]/dishes/new">) {
  const [allowance, importUsage, voiceUsage, params] = await Promise.all([
    getMyDishAllowance(),
    getFeatureUsage("import"),
    getFeatureUsage("voice"),
    searchParams,
  ]);
  if (!allowance) notFound();
  if (!allowance.canAdd) return <NewDishBlocked allowance={allowance} />;
  return (
    <DishFormPage>
      <NewDishFlow importUsage={importUsage} voiceUsage={voiceUsage} sharedUrl={sharedLink(params)} />
    </DishFormPage>
  );
}
