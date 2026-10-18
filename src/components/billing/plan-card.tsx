"use client";

import { CircleAlertIcon, CreditCardIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { TRIAL_DAYS } from "@config/plans";
import { SettingsSection } from "@/components/settings/settings-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import type { BillingStatusDto } from "@/server/features/billing/dto";

import { useBillingRedirect } from "./use-billing-redirect";
import { usePlanCopy } from "./use-plan-copy";

type PlanCardProps = { status: Omit<BillingStatusDto, "usage"> };

/** Settings → Plan & billing: the plan, where it comes from, and what happens next. */
export function PlanCard({ status }: PlanCardProps) {
  const t = useTranslations("billing");
  const tPlans = useTranslations("plans");
  const format = useFormatter();
  const copy = usePlanCopy();
  const redirect = useBillingRedirect();
  const plan = tPlans(`${status.plan}.name`);
  const { next } = status;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });
  const price =
    status.priceCents !== null && status.interval ? copy.pricePer(status.priceCents, status.interval) : null;

  const summary = (() => {
    switch (next.kind) {
      case "renews":
        return price ? t("plan.renews", { date: date(next.at), price }) : t("plan.active");
      case "trial_converts":
        return t("plan.trialConverts", { date: date(next.at), price: price ?? "" });
      case "ends":
        return status.source === "comp"
          ? t("plan.compEnds", { date: date(next.at) })
          : t("plan.ends", { plan, date: date(next.at) });
      case "grace":
        return null;
      case "none":
        if (status.plan === "free") return t("plan.free");
        return status.source === "comp" ? t("plan.compForever") : t("plan.active");
    }
  })();

  // One Stripe button at a time: the most urgent reason to open the portal wins.
  const keepPlan = next.kind === "ends" && status.source !== "comp";
  const showManage = status.canManageBilling && next.kind !== "grace" && !keepPlan;

  const portalButton = (label: string, variant: "default" | "outline") => (
    <Button variant={variant} disabled={redirect.pending !== null} onClick={redirect.openPortal}>
      {redirect.pending === "portal" ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <CreditCardIcon aria-hidden="true" data-icon="inline-start" />
      )}
      {label}
    </Button>
  );

  return (
    <SettingsSection title={t("plan.heading")} description={t("plan.description")}>
      <div className="space-y-5">
        {next.kind === "grace" ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{t("grace.title")}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{t("grace.body", { date: date(next.at), plan })}</p>
              {status.canManageBilling ? portalButton(t("grace.cta"), "default") : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-4xl">{plan}</p>
            {status.source !== "free" ? (
              <Badge variant={status.source === "trial" ? "default" : "secondary"}>
                {t(`plan.source.${status.source}`)}
              </Badge>
            ) : null}
            {status.interval ? <Badge variant="outline">{t(`plan.interval.${status.interval}`)}</Badge> : null}
          </div>
          {summary ? <p className="max-w-prose text-pretty text-muted-foreground">{summary}</p> : null}
          {status.plan === "free" && status.trialAvailable ? (
            <p className="text-sm font-medium text-primary-strong">{t("plan.trialAvailable", { days: TRIAL_DAYS })}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {keepPlan && status.canManageBilling ? portalButton(t("plan.keepPlan"), "default") : null}
            <Button asChild variant={status.plan === "free" ? "default" : "outline"}>
              <Link href="/pricing">{t("plan.comparePlans")}</Link>
            </Button>
            {showManage ? portalButton(t("plan.manage"), "outline") : null}
          </div>
          {status.canManageBilling ? (
            <p className="text-xs text-pretty text-muted-foreground">{t("plan.manageHint")}</p>
          ) : null}
        </div>
      </div>
    </SettingsSection>
  );
}
