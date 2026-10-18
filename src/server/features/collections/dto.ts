// What the UI may know about collections. Types only: safe for the UI.

export type CollectionDto = {
  id: string;
  name: string;
  /** Dishes in it (deleted dishes don't count). */
  dishCount: number;
};

export type CollectionAllowanceDto = {
  count: number;
  /** null = unlimited. */
  limit: number | null;
  canAdd: boolean;
};
