/**
 * How long the browser keeps a page it has shown, so going back to it is
 * instant instead of a skeleton (Next's `staleTimes.dynamic`). Every write
 * that changes what a page shows revalidates, which empties this cache, so a
 * kept page can only miss changes made elsewhere (another device), for at
 * most this long. Back/Forward reuse kept pages regardless; see
 * app-shell/route-freshness.tsx for how those are brought up to date.
 */
export const PAGE_CACHE_SECONDS = 5 * 60;
