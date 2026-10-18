// What the UI may know about ingredients. Types only: safe for the UI.
import type { Unit } from "@/lib/dishes";

/** One autocomplete suggestion for an ingredient name. */
export type IngredientSuggestionDto = {
  /** In the person's language (dictionary), or as they wrote it (their own). */
  name: string;
  /** Filled into the unit when the row has none yet. */
  defaultUnit: Unit | null;
  source: "dictionary" | "yours";
};
