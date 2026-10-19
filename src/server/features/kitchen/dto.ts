// What the UI may know about My kitchen. Types only: safe for the UI.

export type PantryItemDto = {
  id: string;
  /** In the viewer's language when it's a dictionary ingredient, otherwise as typed. */
  name: string;
  isStaple: boolean;
};

export type PantryDto = {
  items: PantryItemDto[];
  /** Everyday staples (salt, oil…) not in the kitchen yet, offered in one tap. */
  suggestedStaples: string[];
  /** How many items the kitchen holds at most. */
  limit: number;
};
