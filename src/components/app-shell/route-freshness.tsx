"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { PAGE_CACHE_SECONDS } from "@/lib/page-cache";

/** A page met again through Back/Forward younger than this is left as it is. */
const HISTORY_FRESH_MS = 60_000;

/**
 * What a page arriving at `now` needs, given when the server last rendered
 * its URL in this tab (`seen`). A regular navigation within PAGE_CACHE_SECONDS
 * reuses the kept page, so it stays as old as it was; a later one is fetched
 * anew. Back/Forward reuse the kept page however old it is, so an old one is
 * refreshed. (Refreshing on every return would cost more than it saves:
 * Next empties the whole page cache on any refresh.)
 */
export function arrival(seen: number | undefined, now: number, viaHistory: boolean) {
  if (seen === undefined) return { refresh: false, renderedAt: now };
  const age = now - seen;
  if (viaHistory)
    return age > HISTORY_FRESH_MS ? { refresh: true, renderedAt: now } : { refresh: false, renderedAt: seen };
  return { refresh: false, renderedAt: age < PAGE_CACHE_SECONDS * 1000 ? seen : now };
}

/**
 * Keeps pages shown from the browser's page cache honest. An old page
 * brought back by Back/Forward shows at once and is refreshed in the
 * background: the person reads and acts on it right away, anything that
 * changed meanwhile slides in, and a small "Refreshing…" pill says why.
 */
export function RouteFreshness() {
  const t = useTranslations("common");
  const router = useRouter();
  const url = `${usePathname()}?${useSearchParams().toString()}`;
  const [refreshing, startRefresh] = useTransition();
  // When the server last rendered each URL in this tab.
  const renderedAt = useRef(new Map<string, number>());
  const viaHistory = useRef(false);

  useEffect(() => {
    const onHistory = () => (viaHistory.current = true);
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, []);

  // Only a new URL may trigger a refresh, never the refresh itself.
  const refresh = useEffectEvent(() => startRefresh(() => router.refresh()));

  useEffect(() => {
    const next = arrival(renderedAt.current.get(url), Date.now(), viaHistory.current);
    viaHistory.current = false;
    renderedAt.current.set(url, next.renderedAt);
    // A transition keeps the kept page on screen (no skeleton) until the fresh one is ready.
    if (next.refresh) refresh();
  }, [url]);

  return (
    // Decorative for screen readers: the page itself stays usable, and changes arrive in place.
    <div aria-hidden="true" className="pointer-events-none sticky top-16 z-30 h-0">
      {refreshing ? (
        <div className="flex justify-center pt-2">
          {/* Fades in after a beat: a quick refresh shouldn't flash anything. */}
          <span className="inline-flex animate-in items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm delay-300 duration-200 fill-mode-backwards fade-in motion-reduce:animate-none">
            <Spinner className="size-3.5" />
            {t("refreshing")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
