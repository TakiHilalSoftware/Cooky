"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

import { BusyPill } from "@/components/feedback/busy-pill";
import { PAGE_CACHE_SECONDS } from "@/lib/page-cache";
import { cn } from "@/lib/utils";

import { MAIN_CONTENT_ID } from "./skip-link";

/** A kept page younger than this is shown as it is; an older one is refreshed behind it. */
const KEPT_FRESH_MS = 60_000;

/**
 * What a page arriving at `now` needs, given when the server last rendered
 * its URL in this tab (`seen`). A regular navigation within PAGE_CACHE_SECONDS
 * reuses the kept page; a later one is fetched anew. Back/Forward reuse the
 * kept page however old it is. Either way, a kept page older than a minute
 * shows at once and is refreshed in the background.
 *
 * A page arriving under its route skeleton (`loading`) is being fetched anew
 * whatever the clock says: any refresh or write empties every kept page.
 */
export function arrival(seen: number | undefined, now: number, viaHistory: boolean, loading = false) {
  if (seen === undefined || loading) return { refresh: false, renderedAt: now };
  const age = now - seen;
  const kept = viaHistory || age < PAGE_CACHE_SECONDS * 1000;
  if (!kept) return { refresh: false, renderedAt: now };
  return age > KEPT_FRESH_MS ? { refresh: true, renderedAt: now } : { refresh: false, renderedAt: seen };
}

const RefreshContext = createContext<TransitionStartFunction | null>(null);

/**
 * The page's main region. While a kept page is being refreshed it stays on
 * screen and usable, a little dimmed and marked busy, with a "Refreshing…"
 * note, so the person sees it's about to be brought up to date. Anything they
 * do meanwhile still goes through the server, which has the final word.
 */
export function FreshnessRegion({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [refreshing, startRefresh] = useTransition();
  return (
    <RefreshContext.Provider value={startRefresh}>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        aria-busy={refreshing || undefined}
        className="flex flex-1 flex-col outline-none"
      >
        {/* Reads the URL, so it gets its own boundary instead of holding up the page. */}
        <Suspense fallback={null}>
          <RouteFreshness />
        </Suspense>
        {/* Visual only: `aria-busy` tells screen readers, and changes arrive in place. */}
        <div aria-hidden="true" className="pointer-events-none sticky top-16 z-30 h-0">
          <div className="flex justify-center pt-2">
            {refreshing ? <BusyPill label={t("refreshing")} /> : null}
          </div>
        </div>
        <div
          className={cn(
            "flex flex-1 flex-col transition-opacity duration-200 motion-reduce:transition-none",
            // Dims only after a beat, so a quick refresh never flickers; brightens at once.
            refreshing && "opacity-60 delay-150",
          )}
        >
          {children}
        </div>
      </main>
    </RefreshContext.Provider>
  );
}

/**
 * Keeps pages shown from the browser's page cache honest: notes when the
 * server last rendered each URL in this tab, and refreshes a kept page that
 * has grown old as it comes back into view.
 */
function RouteFreshness() {
  const startRefresh = useContext(RefreshContext);
  const router = useRouter();
  const url = `${usePathname()}?${useSearchParams().toString()}`;
  const renderedAt = useRef(new Map<string, number>());
  const viaHistory = useRef(false);

  useEffect(() => {
    const onHistory = () => (viaHistory.current = true);
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, []);

  // Only a new URL may trigger a refresh, never the refresh itself.
  // A transition keeps the kept page on screen (no skeleton) until the fresh one is ready.
  const refresh = useEffectEvent(() => startRefresh?.(() => router.refresh()));

  useEffect(() => {
    // Route skeletons (loading.tsx) are built from the shared Skeleton, marked data-slot="skeleton".
    const loading = document.getElementById(MAIN_CONTENT_ID)?.querySelector('[data-slot="skeleton"]') != null;
    const next = arrival(renderedAt.current.get(url), Date.now(), viaHistory.current, loading);
    viaHistory.current = false;
    renderedAt.current.set(url, next.renderedAt);
    if (next.refresh) refresh();
  }, [url]);

  return null;
}
