"use client";

import { CircleCheckIcon, ClockIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/feedback/icon-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import type { BillingStatusDto } from "@/server/features/billing/dto";

/** Re-read the plan every 2 s for about 30 s while Stripe's webhook is on its way. */
export const CHECKOUT_POLL_MS = 2_000;
export const CHECKOUT_POLL_ATTEMPTS = 15;

type CheckoutReturnProps = { status: Pick<BillingStatusDto, "plan" | "source" | "next"> };

/**
 * Back from Stripe Checkout (`?checkout=success`). The URL proves nothing,
 * so the plan shown is the one in the database; until the webhook lands it
 * says "Finishing up" and quietly re-reads the server (ARCHITECTURE §5.3).
 */
export function CheckoutReturn({ status }: CheckoutReturnProps) {
  const t = useTranslations("billing.checkout");
  const tPlans = useTranslations("plans");
  const format = useFormatter();
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const active = status.plan !== "free";

  useEffect(() => {
    if (active || attempts >= CHECKOUT_POLL_ATTEMPTS) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempts((n) => n + 1);
    }, CHECKOUT_POLL_MS);
    return () => clearTimeout(timer);
  }, [active, attempts, router]);

  const dismiss = () => router.replace("/settings/billing", { scroll: false });

  if (active) {
    const plan = tPlans(`${status.plan}.name`);
    return (
      <Alert role="status" className="relative pe-12">
        <CircleCheckIcon aria-hidden="true" className="text-primary-strong" />
        <AlertTitle>{t("successTitle", { plan })}</AlertTitle>
        <AlertDescription>
          {status.source === "trial" && status.next.kind === "trial_converts"
            ? t("successTrial", { date: format.dateTime(new Date(status.next.at), { dateStyle: "long" }) })
            : t("successPaid", { plan })}
        </AlertDescription>
        <IconButton label={t("dismiss")} size="icon-sm" className="absolute end-2 top-2" onClick={dismiss}>
          <XIcon aria-hidden="true" />
        </IconButton>
      </Alert>
    );
  }

  if (attempts < CHECKOUT_POLL_ATTEMPTS) {
    return (
      <Alert role="status">
        <Spinner aria-hidden="true" />
        <AlertTitle>{t("pendingTitle")}</AlertTitle>
        <AlertDescription>{t("pendingBody")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert role="status">
      <ClockIcon aria-hidden="true" />
      <AlertTitle>{t("slowTitle")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t("slowBody")}</p>
        <Button
          variant="outline"
          onClick={() => {
            router.refresh();
            setAttempts(0);
          }}
        >
          <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
          {t("checkAgain")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
