"use client";

import { CircleAlertIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useUpgradeSheet } from "@/components/paywall/upgrade-sheet-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { DishAllowanceDto } from "@/server/features/dishes/dto";

/** PRD §3.10: limits stay low-key until they're close. */
const NEAR_CAP = 5;

/**
 * "Add a dish": a link while the box has room; once it's full, the same
 * button explains why and offers more room instead of dead-ending.
 */
export function AddDishButton({ allowance, className }: { allowance: DishAllowanceDto; className?: string }) {
  const t = useTranslations("dishes.list");
  const openUpgrade = useUpgradeSheet();
  if (allowance.canAdd) {
    return (
      <Button asChild size="lg" className={className}>
        <Link href="/dishes/new">
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {t("add")}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      size="lg"
      className={className}
      onClick={() => openUpgrade({ feature: "dishes", reason: "quota_exceeded" })}
    >
      <PlusIcon aria-hidden="true" data-icon="inline-start" />
      {t("add")}
    </Button>
  );
}

/** How full the box is: quiet when there's room, a clear notice at or over the cap. */
export function DishAllowanceNotice({ allowance }: { allowance: DishAllowanceDto }) {
  const t = useTranslations("dishes.list");
  const openUpgrade = useUpgradeSheet();
  const { count, limit } = allowance;
  if (limit === null) return null;

  const getMore = (
    <Button variant="outline" size="sm" onClick={() => openUpgrade({ feature: "dishes", reason: "quota_exceeded" })}>
      <SparklesIcon aria-hidden="true" data-icon="inline-start" />
      {t("getMore")}
    </Button>
  );

  if (allowance.readOnly || !allowance.canAdd) {
    return (
      <Alert role="status" variant={allowance.readOnly ? "destructive" : "default"}>
        <CircleAlertIcon aria-hidden="true" />
        <AlertDescription className="space-y-3">
          <p>{allowance.readOnly ? t("readOnly", { count, limit, over: count - limit }) : t("atCap", { limit })}</p>
          {getMore}
        </AlertDescription>
      </Alert>
    );
  }

  if (limit - count > NEAR_CAP) {
    return (
      <p className="text-sm text-muted-foreground" title={t("allowanceHint", { limit })}>
        {t("allowance", { count, limit })}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm font-medium text-primary-strong" title={t("allowanceHint", { limit })}>
        {t("allowance", { count, limit })}
      </p>
      {getMore}
    </div>
  );
}
