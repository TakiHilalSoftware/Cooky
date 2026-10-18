import { CircleSlashIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EveryPlanIncludes, PricingFaq } from "@/components/billing/pricing-faq";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPricing } from "@/server/features/billing/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("title"), description: t("intro") };
}

export default async function PricingPage({ searchParams }: PageProps<"/[locale]/pricing">) {
  const [{ checkout }, pricing, t, tLimits] = await Promise.all([
    searchParams,
    getPricing(),
    getTranslations("pricing"),
    getTranslations("limits"),
  ]);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
      <header className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="font-heading text-4xl text-balance sm:text-5xl rtl:leading-[1.3]">{t("heading")}</h1>
        <p className="text-lg text-pretty text-muted-foreground">{t("intro")}</p>
      </header>
      {/* Only a notice: the plan itself is always read from the database. */}
      {checkout === "cancelled" ? (
        <Alert role="status" className="mx-auto max-w-2xl">
          <CircleSlashIcon aria-hidden="true" />
          <AlertTitle>{t("cancelledTitle")}</AlertTitle>
          <AlertDescription>{t("cancelledBody")}</AlertDescription>
        </Alert>
      ) : null}
      <PricingPlans pricing={pricing} />
      <p className="mx-auto max-w-2xl text-center text-sm text-pretty text-muted-foreground">
        {t("finePrint")} {tLimits("unlimitedHint")}
      </p>
      <EveryPlanIncludes />
      <PricingFaq />
    </div>
  );
}
