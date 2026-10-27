import { DicesIcon, PlusIcon, RefrigeratorIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Form from "next/form";

import { CollectionChips } from "@/components/collections/collection-chips";
import { EmptyState } from "@/components/feedback/empty-state";
import { PendingResults, PendingScope } from "@/components/feedback/pending-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CookDto } from "@/server/features/cook/dto";

import { CookCard } from "./cook-card";

/** Cook's URL for a what-if: extra ingredients, kitchen items left out, and the collection to choose from. */
function cookHref(extras: string[], without: string[], collection: string | null) {
  return { pathname: "/cook" as const, query: { with: extras, without, ...(collection ? { collection } : {}) } };
}

/**
 * Cook (PRD §3.4): what to make now. Starts from My kitchen; the bar on top
 * tries "what if I also had… / didn't have…" without changing the kitchen.
 */
export function CookView({ cook, locale }: { cook: CookDto; locale: string }) {
  const t = useTranslations("cook");
  const tWeather = useTranslations("weather");
  const tSeason = useTranslations("dishes.season");
  const without = cook.have.filter((h) => !h.active).map((h) => h.id);

  const moodNote = cook.weather
    ? cook.weather.mood === "neutral"
      ? tWeather("mood.neutral", { season: tSeason(cook.season) })
      : tWeather(`mood.${cook.weather.mood}`)
    : t("seasonNote", { season: tSeason(cook.season) });

  return (
    <PendingScope className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl text-balance">{t("title")}</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            {t("description")} {moodNote}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/spin">
            <DicesIcon aria-hidden="true" data-icon="inline-start" />
            {t("spinInstead")}
          </Link>
        </Button>
      </div>

      <section aria-labelledby="cook-have" className="space-y-3 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cook-have" className="font-heading text-xl">
            {t("haveHeading")}
          </h2>
          <Link href="/kitchen" className="text-sm font-medium text-primary-strong underline-offset-4 hover:underline">
            {t("editKitchen")}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{t("haveHint")}</p>
        {cook.have.length === 0 && cook.extras.length === 0 ? (
          <p className="flex items-center gap-2 text-sm">
            <RefrigeratorIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            {t.rich("emptyKitchen", {
              link: (chunks) => (
                <Link href="/kitchen" className="font-medium text-primary-strong underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {cook.have.map((item) => {
              const next = item.active ? [...without, item.id] : without.filter((id) => id !== item.id);
              return (
                <li key={item.id}>
                  <Link
                    href={cookHref(cook.extras, next, cook.collection)}
                    scroll={false}
                    aria-pressed={item.active}
                    role="button"
                    title={item.active ? t("leaveOut", { name: item.name }) : t("putBack", { name: item.name })}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors pointer-coarse:min-h-11",
                      item.active
                        ? "border-primary-strong bg-secondary font-medium"
                        : "border-dashed border-border text-muted-foreground line-through",
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
            {cook.extras.map((extra) => (
              <li key={`extra-${extra}`}>
                <Link
                  href={cookHref(
                    cook.extras.filter((e) => e !== extra),
                    without,
                    cook.collection,
                  )}
                  scroll={false}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full border border-primary-strong bg-primary/15 ps-3.5 pe-2.5 text-sm font-medium pointer-coarse:min-h-11"
                >
                  {extra}
                  <XIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">{t("removeExtra", { name: extra })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {cook.extras.length < 10 ? (
          <Form action={`/${locale}/cook`} scroll={false} className="flex flex-col gap-2 sm:flex-row">
            {cook.extras.map((extra) => (
              <input key={extra} type="hidden" name="with" value={extra} />
            ))}
            {without.map((id) => (
              <input key={id} type="hidden" name="without" value={id} />
            ))}
            {cook.collection ? <input type="hidden" name="collection" value={cook.collection} /> : null}
            <label htmlFor="cook-extra" className="sr-only">
              {t("addExtraLabel")}
            </label>
            <Input
              id="cook-extra"
              name="with"
              required
              maxLength={80}
              placeholder={t("addExtraPlaceholder")}
              className="sm:max-w-xs h-9"
            />
            <Button type="submit" variant="outline">
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              {t("addExtra")}
            </Button>
          </Form>
        ) : null}
      </section>

      {cook.total === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <>
              <Button asChild>
                <Link href="/dishes/new">{t("addDish")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/discover">{t("browseDiscover")}</Link>
              </Button>
            </>
          }
        />
      ) : (
        <section aria-label={t("resultsLabel")} className="space-y-4">
          {cook.collections.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("collectionsLabel")}</p>
              <CollectionChips
                collections={cook.collections}
                activeId={cook.collection}
                hrefFor={(id) => cookHref(cook.extras, without, id)}
                label={t("collectionsLabel")}
              />
            </div>
          ) : null}
          <PendingResults>
            {cook.dishes.length === 0 ? (
              <EmptyState
                headingLevel={2}
                title={t("emptyCollectionTitle")}
                description={t("emptyCollectionBody")}
                action={
                  <>
                    <Button asChild>
                      <Link href={cookHref(cook.extras, without, null)} scroll={false}>
                        {t("showAllDishes")}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/dishes?collection=${cook.collection ?? ""}`}>{t("openCollection")}</Link>
                    </Button>
                  </>
                }
              />
            ) : (
              <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cook.dishes.map((dish, index) => (
                  <CookCard key={dish.id} dish={dish} rank={index} />
                ))}
              </ol>
            )}
          </PendingResults>
        </section>
      )}
    </PendingScope>
  );
}
