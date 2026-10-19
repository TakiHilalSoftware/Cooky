// What the UI may know about Spin. Types only: safe for the UI.
import type { CollectionDto } from "@/server/features/collections/dto";
import type { CookCardDto } from "@/server/features/cook/dto";
import type { UsageDto } from "@/server/features/billing/dto";

export type SpinResultDto = {
  dish: CookCardDto;
  /** With ingredients: did the dish use all of them, or only some (the fallback)? */
  matchMode: "all" | "any" | null;
};

export type SpinPageDto = {
  usage: UsageDto | null;
  total: number;
  collections: CollectionDto[];
  /** Already picked today (no repeats until tomorrow). */
  pickedToday: { id: string; name: string }[];
  /** What's in My kitchen, to start "With my ingredients" from. */
  kitchen: string[];
};
