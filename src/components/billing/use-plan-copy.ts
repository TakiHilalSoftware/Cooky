import { useFormatter, useTranslations } from "next-intl";

import type { BillingInterval } from "@config/plans";
import {
  COUNTED_FEATURES,
  METERED_FEATURES,
  type CountedFeature,
  type MeteredFeature,
  type PlanFeature,
} from "@/lib/plan-features";
import type { FeatureLimitDto } from "@/server/features/billing/dto";

type CountableFeature = MeteredFeature | CountedFeature;

const COUNTABLE: readonly PlanFeature[] = [...METERED_FEATURES, ...COUNTED_FEATURES];

function isCountable(feature: PlanFeature): feature is CountableFeature {
  return COUNTABLE.includes(feature);
}

/**
 * One wording for plans, prices and limits everywhere (PRD §3.10
 * "Consistency"): the Pricing page, Plan & billing and the upgrade sheet all
 * say "150 questions a month" and "€3.99 a month" the same way. Values always
 * come from the server; this only turns them into words.
 */
export function usePlanCopy() {
  const t = useTranslations();
  const format = useFormatter();

  const price = (cents: number) =>
    format.number(cents / 100, {
      style: "currency",
      currency: "EUR",
      // Whole prices read as "€0", others as "€3.99".
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });

  const amount = (feature: PlanFeature, count: number) =>
    isCountable(feature) ? t(`features.amounts.${feature}`, { count }) : format.number(count);

  return {
    price,
    pricePer: (cents: number, interval: BillingInterval) => t("limits.pricePer", { price: price(cents), interval }),
    percent: (whole: number) => format.number(whole / 100, { style: "percent" }),
    featureName: (feature: PlanFeature) => t(`features.names.${feature}`),
    featureDescription: (feature: PlanFeature) => t(`features.descriptions.${feature}`),
    amount,
    /** "150 questions a month", "Up to 500 dishes", "Unlimited", "Included", "Not included". */
    limitText: ({ feature, limit, period }: FeatureLimitDto) => {
      if (limit === 0) return t("limits.notIncluded");
      if (limit === null) return isCountable(feature) ? t("limits.unlimited") : t("limits.included");
      const text = amount(feature, limit);
      if (period === "month") return t("limits.perMonth", { amount: text });
      if (period === "day") return t("limits.perDay", { amount: text });
      return t("limits.cap", { amount: text });
    },
  };
}
