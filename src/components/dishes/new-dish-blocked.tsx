"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { useUpgradeSheet } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { DishAllowanceDto } from "@/server/features/dishes/dto";

/** Shown instead of the form when the box is full (or over the limit): why, and two ways forward. */
export function NewDishBlocked({ allowance }: { allowance: DishAllowanceDto }) {
  const t = useTranslations("dishes");
  const openUpgrade = useUpgradeSheet();
  const limit = allowance.limit ?? 0;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <EmptyState
        headingLevel={1}
        title={t("newBlocked.title")}
        description={
          allowance.readOnly
            ? t("newBlocked.readOnlyBody", { count: allowance.count, limit })
            : t("newBlocked.body", { limit })
        }
        action={
          <>
            <Button size="lg" onClick={() => openUpgrade({ feature: "dishes", reason: "quota_exceeded" })}>
              <SparklesIcon aria-hidden="true" data-icon="inline-start" />
              {t("list.getMore")}
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dishes">{t("newBlocked.back")}</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
