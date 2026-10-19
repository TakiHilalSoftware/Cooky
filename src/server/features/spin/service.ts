import "server-only";

// The wheel's weighting (PRD §3.4). Pure: unit-tested.

/** Suits today's weather/season ×3, no season set ×2, another season ×1: favoured, never certain. */
export function spinWeight(weatherFit: 0 | 1 | 2): number {
  return weatherFit + 1;
}

/** A weighted random pick; `random` is injectable so tests are deterministic. */
export function pickWeighted<T extends { weight: number }>(items: T[], random: () => number = Math.random): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (items.length === 0 || total <= 0) return null;
  let target = random() * total;
  for (const item of items) {
    target -= Math.max(0, item.weight);
    if (target < 0) return item;
  }
  return items[items.length - 1]!;
}
