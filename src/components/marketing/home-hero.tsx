import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { TilePanel } from "./tile-panel";

export function HomeHero({ signedIn, children }: { signedIn: boolean; children?: ReactNode }) {
  const t = useTranslations("home");
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-24">
        <div className="space-y-6">
          <h1 className="font-heading text-5xl leading-[1.05] text-balance sm:text-6xl lg:text-7xl rtl:leading-[1.3]">
            {t("headline")}
          </h1>
          <p className="max-w-xl text-xl text-pretty text-muted-foreground sm:text-2xl">{t("tagline")}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {signedIn ? (
              <Button asChild size="lg">
                <Link href="/dishes">{t("ctaSignedIn")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/signup">{t("ctaSignUp")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">{t("ctaLogIn")}</Link>
                </Button>
              </>
            )}
          </div>
          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            {t("seePricing")}
          </Link>
        </div>
        <TilePanel className="aspect-[5/2] w-full sm:aspect-[3/1] lg:aspect-square lg:max-w-md lg:justify-self-end" />
      </section>
      {children}
    </div>
  );
}
