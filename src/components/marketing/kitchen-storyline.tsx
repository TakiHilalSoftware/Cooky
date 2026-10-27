import {
  ChefHatIcon,
  CheckCircle2Icon,
  LinkIcon,
  MoonStarIcon,
  RefrigeratorIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function KitchenStoryline({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("home");
  const target = signedIn ? "/dishes" : "/signup";

  return (
    <section aria-labelledby="storyline-heading" className="space-y-16 border-t border-border py-16 sm:py-24">
      {/* Editorial Section Heading */}
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <h2 id="storyline-heading" className="font-heading text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          {t("featuresHeading")}
        </h2>
        <p className="text-lg text-pretty text-muted-foreground sm:text-xl">
          {t("story.superpowers")}
        </p>
      </div>

      {/* Act 1: The Decision Engine */}
      <div className="grid items-center gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-5 lg:col-span-6">
          <Badge variant="secondary" className="font-semibold text-primary-strong">
            <RefrigeratorIcon className="me-1.5 size-3.5" aria-hidden="true" />
            {t("story.act1Badge")}
          </Badge>
          <h3 className="font-heading text-2xl font-bold sm:text-3xl lg:text-4xl">
            {t("story.act1Title")}
          </h3>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            {t("story.act1Subtitle")}
          </p>

          <ul className="space-y-2.5 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Pantry-first ranking:</strong> Dishes you can cook right now (0 missing ingredients) sit at the top.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Weather & season aware:</strong> Cold drizzle boosts warm stews; sunny heatwaves elevate crisp salads.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Spin the wheel:</strong> When you can&apos;t agree, let Cooky pick tonight&apos;s dinner with delightful serendipity.
              </span>
            </li>
          </ul>

          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href={target}>
                {signedIn ? t("features.cook.title") : t("ctaSignUp")} →
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-muted/60 shadow-lg lg:col-span-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/app-preview/frame-01-weather-pantry.png"
            alt="Cooky My Kitchen pantry matching interface"
            width={1200}
            height={800}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* Act 2: Cooking Mode */}
      <div className="grid items-center gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-12 lg:gap-12">
        <div className="order-2 overflow-hidden rounded-2xl border border-border bg-muted/60 shadow-lg lg:order-1 lg:col-span-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/app-preview/frame-02-cooking-timer.png"
            alt="Cooky Cooking Mode with large step font and simultaneous timer"
            width={1200}
            height={800}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        </div>

        <div className="order-1 space-y-5 lg:order-2 lg:col-span-6">
          <Badge variant="secondary" className="font-semibold text-primary-strong">
            <ChefHatIcon className="me-1.5 size-3.5" aria-hidden="true" />
            {t("story.act2Badge")}
          </Badge>
          <h3 className="font-heading text-2xl font-bold sm:text-3xl lg:text-4xl">
            {t("story.act2Title")}
          </h3>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            {t("story.act2Subtitle")}
          </p>

          <ul className="space-y-2.5 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Screen Wake-Lock:</strong> Your phone or tablet stays awake the entire time you&apos;re cooking. No greasy fingers on glass.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Simultaneous timers:</strong> Boil eggs, simmer sauce, and rest dough with named timers that chime reliably.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Log & Remember:</strong> Rate what you cooked and track your personal kitchen journal day by day.
              </span>
            </li>
          </ul>

          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href={target}>
                {signedIn ? t("features.timer.title") : t("ctaSignUp")} →
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Act 3: Planner & Offline Shopping List */}
      <div className="grid items-center gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-5 lg:col-span-6">
          <Badge variant="secondary" className="font-semibold text-primary-strong">
            <ShoppingBagIcon className="me-1.5 size-3.5" aria-hidden="true" />
            {t("story.act3Badge")}
          </Badge>
          <h3 className="font-heading text-2xl font-bold sm:text-3xl lg:text-4xl">
            {t("story.act3Title")}
          </h3>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            {t("story.act3Subtitle")}
          </p>

          <ul className="space-y-2.5 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Sorted by grocery aisle:</strong> Produce, Spices, Dairy, Meat. Walk down the aisle once and tick items off.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Skips your staples:</strong> Salt, oil, and spices you already have at home are automatically omitted.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                <strong className="font-semibold">100% Offline in stores:</strong> Underground supermarkets with zero cellular reception? Your list works flawlessly.
              </span>
            </li>
          </ul>

          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href={target}>
                {signedIn ? t("features.shopping.title") : t("ctaSignUp")} →
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-muted/60 shadow-lg lg:col-span-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/app-preview/frame-04-shopping.png"
            alt="Cooky Aisle-sorted offline shopping list"
            width={1200}
            height={800}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* Core Superpowers Ribbon (The other 5 capabilities) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary-strong">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
            <SparklesIcon className="size-5" aria-hidden="true" />
          </span>
          <h4 className="mt-3 font-heading text-lg font-bold">{t("story.aiTitle")}</h4>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("story.aiDesc")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary-strong">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
            <LinkIcon className="size-5" aria-hidden="true" />
          </span>
          <h4 className="mt-3 font-heading text-lg font-bold">{t("story.importTitle")}</h4>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("story.importDesc")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary-strong">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
            <UsersIcon className="size-5" aria-hidden="true" />
          </span>
          <h4 className="mt-3 font-heading text-lg font-bold">{t("story.scaleTitle")}</h4>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("story.scaleDesc")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary-strong">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
            <MoonStarIcon className="size-5" aria-hidden="true" />
          </span>
          <h4 className="mt-3 font-heading text-lg font-bold">{t("story.ramadanTitle")}</h4>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("story.ramadanDesc")}</p>
        </div>
      </div>
    </section>
  );
}
