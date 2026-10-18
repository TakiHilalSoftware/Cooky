import { useTranslations } from "next-intl";

import { ZelligeStar } from "@/components/brand/zellige-star";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { TilePanel } from "./tile-panel";

const PILLARS = ["decide", "plan", "share"] as const;

export function HomeHero({ signedIn }: { signedIn: boolean }) {
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
                <Link href="/settings">{t("ctaSignedIn")}</Link>
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
        </div>
        <TilePanel className="aspect-[5/2] w-full sm:aspect-[3/1] lg:aspect-square lg:max-w-md lg:justify-self-end" />
      </section>

      <section aria-labelledby="pillars-heading" className="border-t border-border py-12 sm:py-16">
        <h2 id="pillars-heading" className="sr-only">
          {t("pillarsLabel")}
        </h2>
        <dl className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {PILLARS.map((key) => (
            <div key={key} className="space-y-2">
              <dt className="flex items-center gap-2.5 font-heading text-xl">
                <ZelligeStar className="size-5" />
                {t(`pillars.${key}.title`)}
              </dt>
              <dd className="text-pretty text-muted-foreground">{t(`pillars.${key}.body`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
