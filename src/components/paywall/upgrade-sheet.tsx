"use client";

import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PLANS, TRIAL_DAYS } from "@config/plans";
import { useBillingRedirect } from "@/components/billing/use-billing-redirect";
import { usePlanCopy } from "@/components/billing/use-plan-copy";
import { IconButton } from "@/components/feedback/icon-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import type { PlanFeature } from "@/lib/plan-features";
import type { UpgradeOfferDto, UpgradeOptionDto } from "@/server/features/billing/dto";

export type UpgradeRequest = {
  feature: PlanFeature;
  /** What the action said, or "more" when the person asked for more themselves. */
  reason: "quota_exceeded" | "plan_required" | "more";
};

export type UpgradeSheetState =
  { status: "loading" } | { status: "error" } | { status: "ready"; offer: UpgradeOfferDto };

type UpgradeSheetProps = {
  request: UpgradeRequest;
  state: UpgradeSheetState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
};

/**
 * Opens where a limit is hit (PRD §3.7): what ran out, when it comes back,
 * and what Plus or Pro would give, with the price. It always offers a way
 * forward and closes in one tap (PRD §3.10).
 */
export function UpgradeSheet({ request, state, open, onOpenChange, onRetry }: UpgradeSheetProps) {
  const t = useTranslations("upgrade");
  const tCommon = useTranslations("common");
  const copy = usePlanCopy();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        // Focus the sheet itself, so screen readers start at the title and the close tooltip doesn't pop up.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        // Phones: a bottom sheet. Wider screens: a card floating at the bottom end corner.
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)] outline-none sm:data-[side=bottom]:inset-x-auto sm:data-[side=bottom]:end-4 sm:data-[side=bottom]:bottom-4 sm:data-[side=bottom]:w-[calc(100%-2rem)] sm:data-[side=bottom]:max-w-md sm:data-[side=bottom]:rounded-3xl sm:data-[side=bottom]:border"
      >
        <SheetClose asChild>
          <IconButton label={t("close")} className="absolute end-3 top-3">
            <XIcon aria-hidden="true" />
          </IconButton>
        </SheetClose>
        {state.status === "ready" ? (
          <OfferBody request={request} offer={state.offer} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <SheetHeader className="gap-1 p-5 pe-14">
              <p className="text-sm font-medium text-primary-strong">{copy.featureName(request.feature)}</p>
              <SheetTitle className="font-heading text-2xl">
                {state.status === "error" ? t("errorTitle") : t("loading")}
              </SheetTitle>
              <SheetDescription className={state.status === "loading" ? "sr-only" : undefined}>
                {state.status === "error" ? t("errorBody") : t("loading")}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-5 pb-5">
              {state.status === "loading" ? (
                <div role="status" className="space-y-3">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onRetry}>
                    <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
                    {tCommon("tryAgain")}
                  </Button>
                  <CompareLink onClose={() => onOpenChange(false)} />
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CompareLink({ onClose, variant = "outline" }: { onClose: () => void; variant?: "outline" | "link" }) {
  const t = useTranslations("upgrade");
  return (
    <Button asChild variant={variant} className={variant === "link" ? "px-0" : undefined}>
      <Link href="/pricing" onClick={onClose}>
        {t("compare")}
      </Link>
    </Button>
  );
}

function OfferBody({
  request,
  offer,
  onClose,
}: {
  request: UpgradeRequest;
  offer: UpgradeOfferDto;
  onClose: () => void;
}) {
  const t = useTranslations("upgrade");
  const tPlans = useTranslations("plans");
  const format = useFormatter();
  const copy = usePlanCopy();
  const planName = tPlans(`${offer.plan}.name`);
  const { usage, current } = offer;

  let title: string;
  let description: string;
  if (usage && usage.limit !== 0 && usage.remaining === 0 && usage.limit !== null) {
    title = t("usedUp", { amount: copy.amount(offer.feature, usage.limit), period: usage.period });
    description = usage.resetsAt
      ? t("resets", {
          date: format.dateTime(
            new Date(usage.resetsAt),
            usage.period === "day" ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "long" },
          ),
        })
      : copy.featureDescription(offer.feature);
  } else if (current.limit === 0) {
    const lowest = offer.options[0]?.plan ?? PLANS[PLANS.length - 1]!;
    title = t("gated", { feature: copy.featureName(offer.feature), plan: tPlans(`${lowest}.name`) });
    description = copy.featureDescription(offer.feature);
  } else if (request.reason === "quota_exceeded" && !usage && current.limit !== null) {
    title = t("atCap", { amount: copy.amount(offer.feature, current.limit) });
    description = t("atCapBody", { plan: planName });
  } else if (current.limit !== null) {
    title = t("more", { amount: copy.amount(offer.feature, current.limit), period: current.period });
    description = copy.featureDescription(offer.feature);
  } else {
    title = copy.featureName(offer.feature);
    description = copy.featureDescription(offer.feature);
  }

  return (
    <>
      <SheetHeader className="gap-1 p-5 pe-14">
        <p className="text-sm font-medium text-primary-strong">{copy.featureName(offer.feature)}</p>
        <SheetTitle className="font-heading text-2xl text-balance">{title}</SheetTitle>
        <SheetDescription className="text-pretty">{description}</SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-5">
        {offer.options.length > 0 ? (
          <ul aria-label={t("optionsLabel")} className="space-y-3">
            {offer.options.map((option, index) => (
              <OptionCard key={option.plan} option={option} offer={offer} featured={index === 0} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted p-4 text-sm">{t("topPlan", { plan: planName })}</p>
        )}
        <p className="text-xs text-pretty text-muted-foreground">{t("safe")}</p>
      </div>

      <div className="flex flex-wrap-reverse items-center justify-between gap-2 p-5">
        <SheetClose asChild>
          <Button variant="ghost">{offer.options.length > 0 ? t("notNow") : t("gotIt")}</Button>
        </SheetClose>
        <CompareLink variant="link" onClose={onClose} />
      </div>
    </>
  );
}

function OptionCard({
  option,
  offer,
  featured,
}: {
  option: UpgradeOptionDto;
  offer: UpgradeOfferDto;
  /** The next plan up gets the filled button; the rest stay outlined. */
  featured: boolean;
}) {
  const t = useTranslations("upgrade");
  const tPricing = useTranslations("pricing");
  const tPlans = useTranslations("plans");
  const copy = usePlanCopy();
  const redirect = useBillingRedirect();
  const name = tPlans(`${option.plan}.name`);
  const monthly = copy.pricePer(option.prices.month, "month");

  const busy = offer.subscribed ? redirect.pending === "portal" : redirect.pending === `${option.plan}-month`;
  const label = offer.subscribed
    ? tPricing("switchCta", { plan: name })
    : offer.trialAvailable
      ? tPricing("trialCta", { days: TRIAL_DAYS })
      : tPricing("upgradeCta", { plan: name });

  return (
    <li className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-heading text-xl">{name}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{monthly}</p>
      </div>
      <p className="flex items-start gap-2 font-medium">
        <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-strong" />
        <span>
          {copy.limitText(option.limit)}
          <span className="sr-only">: {copy.featureName(offer.feature)}</span>
        </span>
      </p>
      <Button
        variant={featured ? "default" : "outline"}
        className="w-full"
        size="lg"
        disabled={redirect.pending !== null}
        aria-label={offer.trialAvailable && !offer.subscribed ? `${label}: ${name}` : undefined}
        onClick={() => (offer.subscribed ? redirect.openPortal() : redirect.startPlan(option.plan, "month"))}
      >
        {busy ? <Spinner data-icon="inline-start" /> : null}
        {label}
      </Button>
      {offer.trialAvailable && !offer.subscribed ? (
        <p className="text-xs text-muted-foreground">{t("trialNote", { days: TRIAL_DAYS, price: monthly })}</p>
      ) : null}
    </li>
  );
}
