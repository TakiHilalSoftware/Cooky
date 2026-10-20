"use client";

import { useQueryClient, type MutationKey, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { useLayoutEffect } from "react";

/**
 * Server renders each cache has already taken in. A page shown again from
 * the browser's page cache (lib/page-cache.ts) hands back the very same
 * object, which by then may be older than the cache: it is skipped, and the
 * background refresh that follows brings a new one.
 */
const seeded = new WeakMap<QueryClient, WeakSet<object>>();

/**
 * The page's render is the newest truth whenever it arrives: on every
 * mount and every server refresh, write it into the cache before paint, so a
 * cache kept from an earlier visit never shows an older version. Skipped
 * while writes to the same data are in flight, so their previews stay.
 */
export function useServerSeed<T>(queryKey: QueryKey, fresh: T, writes?: MutationKey) {
  const client = useQueryClient();
  useLayoutEffect(() => {
    if (writes && client.isMutating({ mutationKey: writes }) > 0) return;
    const taken = seeded.get(client) ?? new WeakSet<object>();
    seeded.set(client, taken);
    if (typeof fresh === "object" && fresh !== null) {
      if (taken.has(fresh)) return;
      taken.add(fresh);
    }
    client.setQueryData(queryKey, fresh);
    // The key is rebuilt each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, fresh, JSON.stringify(queryKey), writes]);
}
