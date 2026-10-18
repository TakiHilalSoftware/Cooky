"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PLANS, type Plan } from "@config/plans";
import { isLow, TriesMeter } from "@/components/paywall/tries-meter";
import { useUpgradeSheet } from "@/components/paywall/upgrade-sheet-provider";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import type { UsageDto } from "@/server/features/billing/dto";

import { usePlanCopy } from "./use-plan-copy";

/** Tries left this period for every metered feature, with a way to get more when they run low. */
export function UsageCard({ usage, plan }: { usage: UsageDto[]; plan: Plan }) {
  const t = useTranslations("billing.usage");
  const copy = usePlanCopy();
  const openUpgrade = useUpgradeSheet();

  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {usage.map((item) => {
          // Offer more only where it helps: running low, and a bigger plan exists.
          const action =
            (isLow(item) || item.remaining === 0) && plan !== PLANS.at(-1) ? (
              <Button
                variant="outline"
                size="sm"
                aria-label={t("getMoreLabel", { feature: copy.featureName(item.feature) })}
                onClick={() =>
                  openUpgrade({ feature: item.feature, reason: item.remaining === 0 ? "quota_exceeded" : "more" })
                }
              >
                <SparklesIcon aria-hidden="true" data-icon="inline-start" />
                {t("getMore")}
              </Button>
            ) : undefined;
          return (
            <li key={item.feature} className="flex">
              <TriesMeter usage={item} action={action} className="w-full" />
            </li>
          );
        })}
      </ul>
    </SettingsSection>
  );
}
