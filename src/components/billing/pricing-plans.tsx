"use client";

import { CheckIcon, MinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PLAN_RANK, TRIAL_DAYS, type BillingInterval, type PaidPlan, type Plan } from "@config/plans";
import { CookyIcon } from "@/components/brand/cooky-icon";
import { TilePanel } from "@/components/marketing/tile-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "@/i18n/navigation";
import { GATED_FEATURES, type PlanFeature } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import type { FeatureLimitDto, PricingDto, PricingPlanDto, PricingViewerDto } from "@/server/features/billing/dto";

import { useBillingRedirect } from "./use-billing-redirect";
import { usePlanCopy } from "./use-plan-copy";

type Cta =
  | { kind: "signup"; label: string; note?: string }
  | { kind: "checkout"; plan: PaidPlan; label: string; note?: string }
  | { kind: "portal"; label: string; note?: string }
  | { kind: "none"; note?: string };

const isGated = (feature: PlanFeature) => (GATED_FEATURES as readonly PlanFeature[]).includes(feature);

/** The Pricing page's plans: a monthly/yearly switch and one card per plan. */
export function PricingPlans({ pricing }: { pricing: PricingDto }) {
  const t = useTranslations("pricing");
  const copy = usePlanCopy();
  // One redirect for the page, so starting one plan disables the others.
  const redirect = useBillingRedirect();
  const [interval, setBillingInterval] = useState<BillingInterval>("month");
  const bestSaving = Math.max(...pricing.plans.map((p) => p.yearlySavingsPercent ?? 0));

  return (
    <div className="space-y-8">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={interval}
        // Radix sends "" when the active item is clicked again; keep the current choice.
        onValueChange={(value) => (value === "month" || value === "year" ? setBillingInterval(value) : undefined)}
        aria-label={t("intervalLabel")}
        className="mx-auto rounded-full bg-card p-1 shadow-xs"
      >
        <ToggleGroupItem value="month" className="h-11 rounded-full! border-0! px-5 data-[state=on]:bg-secondary">
          {t("monthly")}
        </ToggleGroupItem>
        <ToggleGroupItem value="year" className="h-11 gap-2 rounded-full! border-0! px-5 data-[state=on]:bg-secondary">
          {t("yearly")}
          {bestSaving > 0 ? (
            <Badge className="font-semibold">{t("yearlySave", { percent: copy.percent(bestSaving) })}</Badge>
          ) : null}
        </ToggleGroupItem>
      </ToggleGroup>

      <ul className="grid gap-5 lg:grid-cols-3">
        {pricing.plans.map((plan) => (
          <PlanCard key={plan.plan} plan={plan} interval={interval} viewer={pricing.viewer} redirect={redirect} />
        ))}
      </ul>
    </div>
  );
}

function useCta(plan: Plan, viewer: PricingViewerDto, monthlyOrYearly: string | null): Cta {
  const t = useTranslations("pricing");
  const tPlans = useTranslations("plans");
  const name = tPlans(`${plan}.name`);
  const trialNote = monthlyOrYearly ? t("trialNote", { days: TRIAL_DAYS, price: monthlyOrYearly }) : undefined;

  if (!viewer.signedIn) {
    return plan === "free"
      ? { kind: "signup", label: t("signUpFree") }
      : { kind: "signup", label: t("trialCta", { days: TRIAL_DAYS }), note: trialNote };
  }
  if (plan === viewer.plan) {
    if (viewer.subscribed) return { kind: "portal", label: t("manageCta"), note: t("portalNote") };
    if (viewer.source === "comp") return { kind: "none", note: t("compNote", { plan: name }) };
    return { kind: "none", note: plan === "free" ? t("freeCurrentNote") : undefined };
  }
  // Every change to a live subscription (up, down or cancel) goes through the portal.
  if (viewer.subscribed) {
    // The current plan's card explains where changes happen; saying it on every card is noise.
    return { kind: "portal", label: t("switchCta", { plan: name }) };
  }
  if (plan === "free" || PLAN_RANK[plan] < PLAN_RANK[viewer.plan]) return { kind: "none" };
  return viewer.trialAvailable
    ? { kind: "checkout", plan, label: t("trialCta", { days: TRIAL_DAYS }), note: trialNote }
    : { kind: "checkout", plan, label: t("upgradeCta", { plan: name }) };
}

type Redirect = ReturnType<typeof useBillingRedirect>;

function PlanCard({
  plan,
  interval,
  viewer,
  redirect,
}: {
  plan: PricingPlanDto;
  interval: BillingInterval;
  viewer: PricingViewerDto;
  redirect: Redirect;
}) {
  const t = useTranslations("pricing");
  const tPlans = useTranslations("plans");
  const copy = usePlanCopy();
  const current = viewer.signedIn && viewer.plan === plan.plan;
  const name = tPlans(`${plan.plan}.name`);
  const cents = plan.prices?.[interval] ?? null;
  const cta = useCta(plan.plan, viewer, cents === null ? null : copy.pricePer(cents, interval));
  const headingId = `plan-${plan.plan}`;

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border border-border bg-card",
        current && "border-primary-strong ring-1 ring-primary-strong",
      )}
    >
      {plan.prices ? (
        // Paid plans wear the zellige band (in the viewer's accent); one height keeps the cards' rows aligned.
        <TilePanel className="h-12 rounded-none shadow-none ring-0" />
      ) : (
        <div aria-hidden="true" className="flex h-12 items-center px-6">
          <CookyIcon className="size-6" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="font-heading text-3xl">
              {name}
            </h2>
            {current ? <Badge variant="outline">{t("yourPlan")}</Badge> : null}
          </div>
          <p className="text-pretty text-muted-foreground">{tPlans(`${plan.plan}.tagline`)}</p>
        </div>

        <div className="space-y-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{copy.price(cents ?? 0)}</span>
            <span className="text-muted-foreground">
              {cents === null ? t("freePrice") : interval === "year" ? t("perYear") : t("perMonth")}
            </span>
          </p>
          {plan.prices ? (
            <p className="min-h-10 text-sm text-pretty text-muted-foreground">
              {interval === "year" && plan.yearlySavingsPercent
                ? t("yearlyEquivalent", {
                    price: copy.price(Math.round(plan.prices.year / 12)),
                    percent: copy.percent(plan.yearlySavingsPercent),
                  })
                : t("monthlyHint")}
            </p>
          ) : (
            <p className="min-h-10" />
          )}
        </div>

        <div className="space-y-2">
          <CtaButton cta={cta} interval={interval} redirect={redirect} featured={plan.plan === "plus"} name={name} />
          {cta.note ? <p className="text-xs text-pretty text-muted-foreground">{cta.note}</p> : null}
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-medium">{t("featuresLabel", { plan: name })}</h3>
          <ul className="space-y-2.5 text-sm">
            {plan.limits.map((limit) => (
              <LimitRow key={limit.feature} limit={limit} />
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

function CtaButton({
  cta,
  interval,
  redirect,
  featured,
  name,
}: {
  cta: Cta;
  interval: BillingInterval;
  redirect: Redirect;
  featured: boolean;
  name: string;
}) {
  if (cta.kind === "none") return null;
  const variant = featured ? "default" : "outline";
  if (cta.kind === "signup") {
    return (
      <Button asChild size="lg" variant={variant} className="w-full">
        <Link href="/signup">{cta.label}</Link>
      </Button>
    );
  }
  const busy = cta.kind === "portal" ? redirect.pending === "portal" : redirect.pending === `${cta.plan}-${interval}`;
  return (
    <Button
      size="lg"
      variant={variant}
      className="w-full"
      disabled={redirect.pending !== null}
      // Two cards can both say "Start 7-day free trial": name the plan for screen readers.
      aria-label={cta.label.includes(name) ? undefined : `${cta.label}: ${name}`}
      onClick={() => (cta.kind === "portal" ? redirect.openPortal() : redirect.startPlan(cta.plan, interval))}
    >
      {busy ? <Spinner data-icon="inline-start" /> : null}
      {cta.label}
    </Button>
  );
}

function LimitRow({ limit }: { limit: FeatureLimitDto }) {
  const t = useTranslations("pricing");
  const copy = usePlanCopy();
  const off = limit.limit === 0;
  const name = copy.featureName(limit.feature);

  if (isGated(limit.feature)) {
    const Icon = off ? MinusIcon : CheckIcon;
    return (
      <li
        className={cn("flex items-start gap-2.5", off && "text-muted-foreground")}
        title={copy.featureDescription(limit.feature)}
      >
        <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", !off && "text-primary-strong")} />
        <span>
          {name}
          <span className="sr-only">: {off ? t("notIncludedLabel") : t("includedLabel")}</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-start justify-between gap-3" title={copy.featureDescription(limit.feature)}>
      <span className="text-muted-foreground">{name}</span>
      <span className={cn("text-end font-medium tabular-nums", off && "text-muted-foreground")}>
        {copy.limitText(limit)}
      </span>
    </li>
  );
}
