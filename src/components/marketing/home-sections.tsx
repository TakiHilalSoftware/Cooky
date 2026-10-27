import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PricingPlans } from "@/components/billing/pricing-plans";
import { CatalogCard } from "@/components/discover/catalog-card";
import { useCountry } from "@/components/discover/use-country";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { PricingDto } from "@/server/features/billing/dto";
import type { HomeDishesDto } from "@/server/features/discover/dto";

import { FEATURES } from "./features";

/** The eight features (PRD §3.0): each opens its page, or sign-up for visitors. */
export function FeatureGrid({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("home");
  return (
    <section aria-labelledby="features-heading" className="space-y-6 border-t border-border py-12 sm:py-16">
      <h2 id="features-heading" className="font-heading text-3xl">
        {t("featuresHeading")}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ key, href, icon: Icon, available }) => {
          // Visitors are invited to sign up; signed-in people go to the page once it exists.
          const target = !signedIn ? "/signup" : available ? href : null;
          return (
            <li
              key={key}
              className="group relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition-colors focus-within:border-primary-strong hover:border-primary-strong"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary-strong">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {!available ? <Badge variant="outline">{t("comingSoon")}</Badge> : null}
              </div>
              <h3 className="font-heading text-xl">
                {target ? (
                  <Link
                    href={target}
                    className="outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                  >
                    {t(`features.${key}.title`)}
                  </Link>
                ) : (
                  t(`features.${key}.title`)
                )}
              </h3>
              <p className="text-sm text-pretty text-muted-foreground">{t(`features.${key}.body`)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export { KitchenStoryline } from "./kitchen-storyline";

/**
 * A row of Discover dishes with a way into the full catalog: today's picks,
 * each with its reason, for a signed-in person; featured dishes for visitors.
 */
export function DiscoverPreview({ data }: { data: HomeDishesDto }) {
  const t = useTranslations("home");
  const country = useCountry();
  if (data.dishes.length === 0) return null;
  return (
    <section aria-labelledby="discover-preview-heading" className="space-y-8 border-t border-border py-16 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="discover-preview-heading" className="font-heading text-3xl font-extrabold sm:text-4xl">
            {data.personalized ? t("discoverPicksHeading") : t("discoverHeading")}
          </h2>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            {data.personalized ? t("discoverPicksBody") : t("discoverBody", { count: data.countryCount })}
          </p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link href="/discover">
            {t("discoverAll")}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
      {/* Phones: a swipe row. Wider screens: a grid. */}
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {data.dishes.slice(0, 6).map((dish) => (
          <CatalogCard
            key={dish.slug}
            dish={dish}
            countryName={country.name(dish.country)}
            reason={dish.reason}
            className="w-80 max-w-[85vw] shrink-0 snap-start sm:w-auto sm:max-w-none"
          />
        ))}
      </ul>
    </section>
  );
}

/** Plans and prices, the same component as the Pricing page. */
export function PricingSection({ pricing }: { pricing: PricingDto }) {
  const t = useTranslations("home");
  return (
    <section aria-labelledby="home-pricing-heading" className="space-y-8 border-t border-border py-12 sm:py-16">
      <div className="mx-auto max-w-2xl space-y-2 text-center">
        <h2 id="home-pricing-heading" className="font-heading text-3xl">
          {t("pricingHeading")}
        </h2>
        <p className="text-pretty text-muted-foreground">{t("pricingBody")}</p>
      </div>
      <PricingPlans pricing={pricing} />
      <p className="text-center">
        <Link href="/pricing" className="font-medium text-primary-strong underline-offset-4 hover:underline">
          {t("seePricing")}
        </Link>
      </p>
    </section>
  );
}
