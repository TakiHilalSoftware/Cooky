import "server-only";

import { normalize } from "@/server/features/ingredients/service";

/** My kitchen holds at most this many items: plenty for a real kitchen, bounded for abuse. */
export const PANTRY_LIMIT = 300;

/** One row per thing: the dictionary entry when known ("Tomatoes" = "tomate"), else the folded name. */
export function pantryKey(name: string, ingredientId: string | null): string {
  return ingredientId ? `i:${ingredientId}` : `n:${normalize(name)}`;
}
