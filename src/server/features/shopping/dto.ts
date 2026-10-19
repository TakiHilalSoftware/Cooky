// What the UI may know about the shopping list. Types only: safe for the UI.
import type { Aisle, Unit } from "@/lib/dishes";

export type ShoppingItemDto = {
  id: string;
  /** In the viewer's language when it's a dictionary ingredient. */
  name: string;
  amount: number | null;
  unit: Unit | null;
  aisle: Aisle;
  checked: boolean;
  /** Typed by hand ("paper towels"), not from a recipe. */
  manual: boolean;
  /** How many dishes need it. */
  dishCount: number;
};

export type ShoppingListDto = {
  /** Goes up on every change: an offline copy with an older version is stale. */
  version: number;
  items: ShoppingItemDto[];
  household: HouseholdDto;
};

/** The Pro household list, as this person sees it. */
export type HouseholdDto = {
  /** Their plan lets them share their list (Pro). */
  canShare: boolean;
  /** People they invited to their own list. */
  members: { userId: string; name: string; status: "pending" | "active" }[];
  /** Invites to someone else's list, waiting for an answer. */
  invites: { listId: string; fromName: string }[];
  /** When shopping from someone else's list: whose. */
  sharedBy: string | null;
};

export type AddToShoppingResult = { added: number; skippedStaples: number };
