import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { TilePanel } from "./tile-panel";

export function HomeHero({ signedIn, children }: { signedIn: boolean; children?: ReactNode }) {
  const t = useTranslations("home");
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-20">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3.5 py-1 text-xs font-semibold text-primary-strong">
            <span className="size-2 rounded-full bg-primary" />
            <span>{t("heroBadge")}</span>
          </div>

          <h1 className="font-heading text-5xl font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl rtl:leading-[1.25]">
            {t("headline")}
          </h1>

          <p className="max-w-xl text-lg text-pretty text-muted-foreground sm:text-xl lg:text-2xl">
            {t("tagline")}
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            {signedIn ? (
              <Button asChild size="lg" className="h-12 px-6 text-base shadow-md shadow-primary/20">
                <Link href="/dishes">{t("ctaSignedIn")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="h-12 px-7 text-base font-semibold shadow-md shadow-primary/20">
                  <Link href="/signup">{t("ctaSignUp")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                  <Link href="/login">{t("ctaLogIn")}</Link>
                </Button>
              </>
            )}
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong underline-offset-4 hover:underline sm:ms-2"
            >
              {t("seePricing")} →
            </Link>
          </div>

          {/* Value Proof Badges */}
          <div className="grid grid-cols-2 gap-2 pt-4 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />
              <span>{t("trustPills.freeTier")}</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />
              <span>{t("trustPills.offline")}</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />
              <span>{t("trustPills.languages")}</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />
              <span>{t("trustPills.privacy")}</span>
            </span>
          </div>
        </div>

        <TilePanel className="w-full lg:justify-self-end" />
      </section>
      {children}
    </div>
  );
}
