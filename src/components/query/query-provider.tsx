"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { shouldRetryQuery } from "./action-query";

/**
 * Server Actions are the only door for data (AGENT_RULES §2), so queries call
 * actions and start from what the page already rendered (`initialData`).
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The page's own render is fresh; don't ask again right after hydrating.
        staleTime: 30_000,
        retry: shouldRetryQuery,
      },
      // Writes aren't idempotent: a failed one is reported, never silently resent.
      mutations: { retry: false },
    },
  });
}

/**
 * The client cache for one signed-in account. The shell mounts it keyed by
 * the account, so signing out or switching accounts starts from an empty
 * cache and nothing from one person can show for another.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
