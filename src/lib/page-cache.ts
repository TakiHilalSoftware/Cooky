/**
 * How long the browser keeps a page it has shown, so going back to it shows
 * at once instead of a skeleton (Next's `staleTimes.dynamic`). A kept page
 * older than a minute is refreshed in the background on arrival (see
 * app-shell/route-freshness.tsx), so this sets how long a page can come back
 * instantly, not how stale it may look. Every write that changes what a page
 * shows revalidates, which empties this cache.
 */
export const PAGE_CACHE_SECONDS = 30 * 60;
