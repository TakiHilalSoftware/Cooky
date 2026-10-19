import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PlannerView } from "@/components/planner/planner-view";
import { asAppLocale } from "@/i18n/routing";
import { getPlanner } from "@/server/features/planner/queries";
import { plannerParamsSchema } from "@/server/features/planner/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planner");
  return { title: t("title") };
}

export default async function PlannerPage({ params, searchParams }: PageProps<"/[locale]/planner">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const planner = await getPlanner(plannerParamsSchema.parse(query).week, asAppLocale(locale));
  if (!planner) notFound();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <PlannerView planner={planner} />
    </div>
  );
}
