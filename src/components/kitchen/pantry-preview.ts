import type { PantryItemDto } from "@/server/features/kitchen/dto";

// How My kitchen looks while a write is on its way (the server's answer then replaces it). Pure: unit-tested.

/** Ids of items shown before the server has saved them; they can't be changed until it has. */
const OPTIMISTIC_PREFIX = "optimistic:";

export const isOptimistic = (item: PantryItemDto) => item.id.startsWith(OPTIMISTIC_PREFIX);

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;

/**
 * The kitchen as it will be once `names` are saved: new names appear at once
 * (marked optimistic), names already there just become staples if asked.
 * The server's answer replaces this, dictionary names and merges included.
 */
export function withAdded(items: PantryItemDto[], names: string[], staple: boolean): PantryItemDto[] {
  const next = items.map((item) =>
    staple && names.some((name) => sameName(name, item.name)) ? { ...item, isStaple: true } : item,
  );
  for (const name of names) {
    if (next.some((item) => sameName(item.name, name))) continue;
    next.push({ id: `${OPTIMISTIC_PREFIX}${name}`, name, isStaple: staple });
  }
  return next;
}
