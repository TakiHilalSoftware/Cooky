"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { BillingInterval, PaidPlan } from "@config/plans";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { openBillingPortal, startCheckout } from "@/server/actions/billing";

/** Which button started the redirect, so only that one shows a spinner. */
export type RedirectTarget = "portal" | `${PaidPlan}-${BillingInterval}`;

/**
 * Sends the person to Stripe: Checkout to buy a plan, the Customer Portal to
 * change or cancel one. Both pages are Stripe-hosted, so this only ever
 * navigates to a URL the server returned (no Stripe JS in the browser).
 */
export function useBillingRedirect() {
  const t = useTranslations("billingActions");
  const locale = useLocale();
  const messages = useFormMessages();
  const [pending, setPending] = useState<RedirectTarget | null>(null);
  const checkout = useAction(startCheckout);
  const portal = useAction(openBillingPortal);

  useEffect(() => {
    // Coming back from Stripe with the Back button restores this page from the
    // back/forward cache, spinner and all; clear it so the buttons work again.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function openPortal() {
    setPending("portal");
    const result = await portal.executeAsync({ locale });
    if (result.data) {
      // Keep the spinner: the page is about to change.
      window.location.assign(result.data.url);
      return;
    }
    setPending(null);
    toast.error(result.serverError === "not_found" ? t("noBillingAccount") : messages.action(result.serverError));
  }

  async function startPlan(plan: PaidPlan, interval: BillingInterval) {
    setPending(`${plan}-${interval}`);
    const result = await checkout.executeAsync({ plan, interval, locale });
    if (result.data?.status === "redirect") {
      window.location.assign(result.data.url);
      return;
    }
    if (result.data?.status === "already_subscribed") {
      // Paying people change plans in the portal; take them there instead of failing.
      toast.info(t("alreadySubscribed"));
      await openPortal();
      return;
    }
    setPending(null);
    toast.error(messages.action(result.serverError));
  }

  return { pending, startPlan, openPortal };
}
