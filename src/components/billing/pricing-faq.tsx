import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TRIAL_DAYS } from "@config/plans";

const EVERY_PLAN = ["cook", "cookingMode", "scaling", "shopping", "kitchen", "sharing"] as const;
const QUESTIONS = ["trial", "cancel", "downgrade", "tries", "switch", "payment"] as const;

/** What every plan shares, so the comparison above stays about the differences. */
export function EveryPlanIncludes() {
  const t = useTranslations("pricing");
  return (
    <section aria-labelledby="every-plan" className="rounded-3xl bg-secondary/60 p-6 sm:p-8">
      <h2 id="every-plan" className="font-heading text-2xl">
        {t("everyPlanHeading")}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EVERY_PLAN.map((key) => (
          <li key={key} className="flex items-start gap-2.5">
            <CheckIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-strong" />
            <span>{t(`everyPlan.${key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Native <details>: keyboard and screen-reader support for free, and it works before JS loads. */
export function PricingFaq() {
  const t = useTranslations("pricing");
  return (
    <section aria-labelledby="pricing-faq" className="space-y-4">
      <h2 id="pricing-faq" className="font-heading text-3xl">
        {t("faqHeading")}
      </h2>
      <div className="divide-y divide-border rounded-3xl border border-border bg-card">
        {QUESTIONS.map((key) => (
          <details key={key} className="group px-5 sm:px-6">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {t(`faq.${key}.q`)}
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-5 text-pretty text-muted-foreground">{t(`faq.${key}.a`, { days: TRIAL_DAYS })}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
