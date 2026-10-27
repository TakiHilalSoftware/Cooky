/** The query keys that narrow Discover's list (the sort and page don't), in URL order. */
export const FILTER_KEYS = ["country", "course", "diet", "collection", "have"] as const;

type DiscoverParams = Partial<Record<(typeof FILTER_KEYS)[number] | "sort" | "page", string | number>>;

/**
 * Discover's query string for `params` with `changes` applied: one builder
 * for collection chips, the sort, the scroll position and the no-JS link,
 * so none of them drops another's state. A null change removes the key.
 */
export function discoverQuery(
  params: DiscoverParams,
  changes: Partial<Record<keyof DiscoverParams, string | number | null>> = {},
): string {
  const query = new URLSearchParams();
  for (const key of [...FILTER_KEYS, "sort", "page"] as const) {
    const value = key in changes ? changes[key] : params[key];
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** True when anything narrows the list. */
export const hasFilters = (params: DiscoverParams) => FILTER_KEYS.some((key) => Boolean(params[key]));
