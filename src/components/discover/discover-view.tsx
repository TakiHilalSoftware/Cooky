import { CompassIcon, InfoIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { PendingResults, PendingScope } from "@/components/feedback/pending-results";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CATALOG_COLLECTIONS, type CatalogCollection } from "@/lib/dishes";
import { cn } from "@/lib/utils";
import type { DiscoverDto } from "@/server/features/discover/dto";
import type { DiscoverFilters as Filters } from "@/server/features/discover/schema";

import { CatalogCard } from "./catalog-card";
import { DiscoverFilters } from "./discover-filters";
import { useCountry } from "./use-country";

/** The URL for these filters with one collection chosen (or none), keeping the rest. */
function withCollection(filters: Filters, collection: CatalogCollection | null) {
  const params = new URLSearchParams();
  for (const key of ["country", "course", "diet", "have"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (collection) params.set("collection", collection);
  const query = params.toString();
  return query ? `/discover?${query}` : "/discover";
}

/** Discover: featured dishes, collections, filters and the catalog. */
export function DiscoverView({ data, filters }: { data: DiscoverDto; filters: Filters }) {
  const t = useTranslations("discover");
  const locale = useLocale();
  const country = useCountry();
  // Named here, on the server, so the filter (a client component) renders the same text in both places.
  const countries = data.countries
    .map((code) => ({ code, name: country.name(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const filtered = Boolean(filters.country || filters.course || filters.diet || filters.have || filters.collection);
  const chip = (selected: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
      selected
        ? "border-primary-strong bg-primary text-primary-foreground"
        : "border-border bg-card hover:border-primary-strong",
    );

  return (
    <PendingScope className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="font-heading text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle", { count: data.countries.length })}</p>
      </header>

      {!filtered && data.featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className="space-y-3">
          <h2 id="featured-heading" className="font-heading text-2xl">
            {t("featured")}
          </h2>
          {/* A scroll-snap row: swipe on phones, no autoplay, nothing moves on its own. */}
          <ul
            aria-label={t("featuredLabel")}
            className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
          >
            {data.featured.map((dish) => (
              <CatalogCard key={dish.slug} dish={dish} className="w-72 shrink-0 snap-start" />
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label={t("collectionsLabel")} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 sm:flex-wrap">
          <li>
            <Link
              href={withCollection(filters, null)}
              scroll={false}
              aria-current={filters.collection ? undefined : "page"}
              className={chip(!filters.collection)}
            >
              {t("allCollections")}
            </Link>
          </li>
          {CATALOG_COLLECTIONS.map((c) => (
            <li key={c}>
              <Link
                href={withCollection(filters, c)}
                scroll={false}
                aria-current={filters.collection === c ? "page" : undefined}
                className={chip(filters.collection === c)}
              >
                {t(`collection.${c}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <DiscoverFilters filters={filters} countries={countries} />

      <PendingResults className="space-y-8">
        {data.matchMode === "any" ? (
          <Alert role="status">
            <InfoIcon aria-hidden="true" />
            <AlertDescription>{t("matchAny")}</AlertDescription>
          </Alert>
        ) : null}

        <p aria-live="polite" className="text-sm text-muted-foreground">
          {t("results", { count: data.dishes.length })}
        </p>

        {data.dishes.length === 0 ? (
          <EmptyState
            headingLevel={2}
            illustration={<CompassIcon aria-hidden="true" className="size-14 text-primary-strong" />}
            title={t("noResultsTitle")}
            description={data.matchMode === "none" ? t("matchNone") : t("noResultsBody")}
            action={
              <Button asChild variant="outline" size="lg">
                <Link href="/discover" replace>
                  <XIcon aria-hidden="true" data-icon="inline-start" />
                  {t("clear")}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.dishes.map((dish) => (
              <CatalogCard key={dish.slug} dish={dish} />
            ))}
          </ul>
        )}
      </PendingResults>

      {!data.signedIn ? (
        <section className="flex flex-col items-start gap-3 rounded-3xl bg-secondary/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-pretty">{t("signUpPitch")}</p>
          <Button asChild size="lg">
            <Link href="/signup">{t("signUp")}</Link>
          </Button>
        </section>
      ) : null}
    </PendingScope>
  );
}
