"use client";

import { ArrowUpIcon, RotateCcwIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { asAppLocale } from "@/i18n/routing";
import { discoverQuery } from "@/lib/discover-url";
import { DISCOVER_PAGE_SIZE } from "@/lib/dishes";
import { loadMoreDiscover } from "@/server/actions/discover";
import type { CatalogPickDto } from "@/server/features/discover/dto";
import type { DiscoverFilters } from "@/server/features/discover/schema";

import { CatalogCard } from "./catalog-card";

/** Start loading this far before the end comes into view, so scrolling rarely meets a spinner. */
const PRELOAD_MARGIN = "900px 0px";

type Status = "idle" | "loading" | "error";

/**
 * Discover's list with infinite scroll. The server renders the pages already
 * shown (`children`); nearing the end loads the next page through a Server
 * Action and appends it. The URL's `page` follows along (without a
 * navigation), so a refresh, Back or a shared link restores the same list.
 * Without JavaScript, a plain link loads the next page instead.
 */
export function DiscoverFeed({
  children,
  shown,
  total,
  nextPage,
  filters,
  countryNames,
}: {
  children: ReactNode;
  /** How many cards `children` holds. */
  shown: number;
  total: number;
  nextPage: number | null;
  filters: DiscoverFilters;
  countryNames: Record<string, string>;
}) {
  const t = useTranslations("discover");
  const tCommon = useTranslations("common");
  const locale = asAppLocale(useLocale());
  const pathname = usePathname();
  const [more, setMore] = useState<CatalogPickDto[]>([]);
  const [next, setNext] = useState(nextPage);
  const [status, setStatus] = useState<Status>("idle");
  const sentinel = useRef<HTMLDivElement>(null);

  // A fresh render from the server (a filter, a refresh after saving) already
  // holds every page loaded so far: start over from it.
  const [rendered, setRendered] = useState({ shown, nextPage });
  if (rendered.shown !== shown || rendered.nextPage !== nextPage) {
    setRendered({ shown, nextPage });
    setMore([]);
    setNext(nextPage);
    setStatus("idle");
  }

  const loadNext = useCallback(async () => {
    if (next === null || status === "loading") return;
    setStatus("loading");
    const { page: _page, ...listFilters } = filters;
    const result = await loadMoreDiscover({ ...listFilters, page: next, locale }).catch(() => undefined);
    const data = result?.data;
    if (!data) {
      setStatus("error");
      return;
    }
    setMore((cards) => {
      const seen = new Set(cards.map((c) => c.slug));
      return [...cards, ...data.dishes.filter((c) => !seen.has(c.slug))];
    });
    setNext(data.nextPage);
    setStatus("idle");
    // Remember how far the list goes without a navigation (Next keeps its router in sync).
    window.history.replaceState(null, "", `${pathname}${discoverQuery(filters, { page: next })}`);
  }, [filters, locale, next, pathname, status]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || next === null || status !== "idle") return;
    // Re-created after each page: if the end is still in view (a tall screen), it loads again at once.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadNext();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadNext, next, status, more.length]);

  const count = shown + more.length;
  const backToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.getElementById("discover-heading")?.focus({ preventScroll: true });
  };

  return (
    <>
      <ul id="discover-results" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
        {more.map((dish) => (
          <CatalogCard
            key={dish.slug}
            dish={dish}
            countryName={countryNames[dish.country] ?? dish.country}
            reason={dish.reason}
          />
        ))}
      </ul>

      {/* Announced once per page, not per card. */}
      <p className="sr-only" role="status" aria-live="polite">
        {more.length > 0 ? t("loadedMore", { shown: count, total }) : ""}
      </p>

      <div ref={sentinel} className="flex min-h-16 flex-col items-center justify-center gap-3 pt-2 text-center">
        {status === "loading" ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="text-primary-strong" />
            {t("loadingMore")}
          </span>
        ) : status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">{t("loadMoreFailed")}</p>
            <Button variant="outline" size="lg" onClick={() => void loadNext()}>
              <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
              {tCommon("tryAgain")}
            </Button>
          </div>
        ) : next === null && total > DISCOVER_PAGE_SIZE ? (
          <>
            <p className="text-sm text-muted-foreground">{t("endOfList", { count: total })}</p>
            <Button variant="ghost" size="lg" onClick={backToTop}>
              <ArrowUpIcon aria-hidden="true" data-icon="inline-start" />
              {t("backToTop")}
            </Button>
          </>
        ) : null}
        {next !== null ? (
          <noscript>
            <a
              href={`${pathname}${discoverQuery(filters, { page: next })}`}
              className="font-medium text-primary-strong underline underline-offset-4"
            >
              {t("moreDishes")}
            </a>
          </noscript>
        ) : null}
      </div>
    </>
  );
}
