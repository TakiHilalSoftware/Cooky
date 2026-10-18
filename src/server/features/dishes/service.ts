import "server-only";

// Pure dish rules (scaling, the dish cap), unit-tested in service.test.ts.

/**
 * Scales an ingredient amount from the recipe's servings to the wanted ones.
 * Rounded to what a cook can measure: whole numbers from 100 up, one decimal
 * from 10, two below. "To taste" (no amount) stays as written.
 */
export function scaleAmount(amount: number | null, fromServings: number, toServings: number): number | null {
  if (amount === null) return null;
  const scaled = (amount * toServings) / fromServings;
  const step = scaled >= 100 ? 1 : scaled >= 10 ? 10 : 100;
  return Math.round(scaled * step) / step;
}

export type DishAllowance = {
  count: number;
  /** null = unlimited. */
  limit: number | null;
  /** Another dish may be added. */
  canAdd: boolean;
  /**
   * More dishes than the plan holds (after a downgrade): everything stays
   * viewable and cookable, but nothing can be added or edited until the
   * person is back under the limit or upgrades (PRD §3.7). Deleting is fine.
   */
  readOnly: boolean;
};

export function dishAllowance(count: number, limit: number | null): DishAllowance {
  return {
    count,
    limit,
    canAdd: limit === null || count < limit,
    readOnly: limit !== null && count > limit,
  };
}
