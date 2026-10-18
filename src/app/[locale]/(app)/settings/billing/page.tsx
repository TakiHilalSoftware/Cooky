import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CheckoutReturn } from "@/components/billing/checkout-return";
import { PlanCard } from "@/components/billing/plan-card";
import { UsageCard } from "@/components/billing/usage-card";
import { getBillingStatus } from "@/server/features/billing/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

export default async function BillingSettingsPage({ searchParams }: PageProps<"/[locale]/settings/billing">) {
  const [{ checkout }, status, t] = await Promise.all([searchParams, getBillingStatus(), getTranslations("billing")]);
  // The (app) layout already sent signed-out visitors to log in.
  if (!status) notFound();
  const { usage, ...plan } = status;
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t("subtitle")}</p>
      {checkout === "success" ? <CheckoutReturn status={plan} /> : null}
      <PlanCard status={plan} />
      <UsageCard usage={usage} plan={plan.plan} />
    </div>
  );
}
