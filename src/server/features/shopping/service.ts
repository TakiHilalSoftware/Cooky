import "server-only";

import type { Aisle, Unit } from "@/lib/dishes";

// The merged shopping list (PRD §3.5, ARCHITECTURE §5.6). Pure: unit-tested.

const MASS: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const VOLUME: Partial<Record<Unit, number>> = { ml: 1, cl: 10, l: 1000, tsp: 5, tbsp: 15, cup: 240 };

/** Amounts in the same family convert into each other; anything else only adds up with the same unit. */
export type UnitFamily = "mass" | "volume" | Unit | "none";

export function familyOf(unit: Unit | null): UnitFamily {
  if (unit === null) return "none";
  if (unit in MASS) return "mass";
  if (unit in VOLUME) return "volume";
  return unit;
}

/** Sensible precision for a shopping amount: 0.25, 12.5, 350. */
export function roundAmount(amount: number): number {
  const step = amount >= 100 ? 1 : amount >= 10 ? 10 : 100;
  return Math.round(amount * step) / step;
}

/** A base amount (g or ml) in the unit people expect to read: 1.2 kg, not 1200 g. */
function display(base: number, family: "mass" | "volume"): { amount: number; unit: Unit } {
  if (family === "mass")
    return base >= 1000 ? { amount: roundAmount(base / 1000), unit: "kg" } : { amount: roundAmount(base), unit: "g" };
  return base >= 1000 ? { amount: roundAmount(base / 1000), unit: "l" } : { amount: roundAmount(base), unit: "ml" };
}

export type Quantity = { amount: number | null; unit: Unit | null };

/**
 * Adds two quantities of the same item. "To taste" (no amount) gives way to a
 * real amount; the same unit just sums; g + kg or tbsp + ml convert.
 */
export function combine(a: Quantity, b: Quantity): Quantity {
  if (a.amount === null) return b.amount === null ? { amount: null, unit: a.unit ?? b.unit } : b;
  if (b.amount === null) return a;
  if (a.unit === b.unit) return { amount: roundAmount(a.amount + b.amount), unit: a.unit };
  const family = familyOf(a.unit);
  if ((family === "mass" || family === "volume") && familyOf(b.unit) === family) {
    const table = family === "mass" ? MASS : VOLUME;
    return display(a.amount * table[a.unit!]! + b.amount * table[b.unit!]!, family);
  }
  // Different, non-convertible units never reach here: they're separate items.
  return a;
}

/** Things bought whole: half a lemon or 4.5 cloves of garlic means buying one more. */
const WHOLE: ReadonlySet<UnitFamily> = new Set(["none", "piece", "clove", "slice", "can", "bunch"]);

/**
 * The amount to buy: counted things round up to whole numbers; measures stay
 * as they are. Applied when the list is read, so exact sums never drift.
 */
export function toBuy(quantity: Quantity): Quantity {
  if (quantity.amount === null || !WHOLE.has(familyOf(quantity.unit))) return quantity;
  return { amount: Math.ceil(quantity.amount - 1e-9), unit: quantity.unit };
}

/** A recipe line on its way to the list. */
export type IncomingLine = {
  key: string;
  name: string;
  ingredientId: string | null;
  amount: number | null;
  unit: Unit | null;
  aisle: Aisle;
  dishId: string | null;
};

export type ListItem = {
  key: string;
  unitFamily: UnitFamily;
  name: string;
  ingredientId: string | null;
  amount: number | null;
  unit: Unit | null;
  aisle: Aisle;
  sourceDishIds: string[];
  checked: boolean;
};

const identity = (item: { key: string; unitFamily: string }) => `${item.key}|${item.unitFamily}`;

/**
 * Merges recipe lines into the list: the same ingredient in a convertible unit
 * becomes one item ("Onions ×5"); a ticked item that comes back is unticked,
 * since it's needed again. Returns only the items that changed or are new.
 */
export function mergeIntoList(existing: ListItem[], incoming: IncomingLine[]): ListItem[] {
  const items = new Map(existing.map((item) => [identity(item), { ...item }]));
  const touched = new Set<string>();
  for (const line of incoming) {
    const unitFamily = familyOf(line.unit);
    const id = identity({ key: line.key, unitFamily });
    const current = items.get(id);
    if (!current) {
      items.set(id, {
        key: line.key,
        unitFamily,
        name: line.name,
        ingredientId: line.ingredientId,
        amount: line.amount === null ? null : roundAmount(line.amount),
        unit: line.unit,
        aisle: line.aisle,
        sourceDishIds: line.dishId ? [line.dishId] : [],
        checked: false,
      });
    } else {
      const sum = combine(current, line);
      current.amount = sum.amount;
      current.unit = sum.unit;
      current.checked = false;
      if (line.dishId && !current.sourceDishIds.includes(line.dishId)) current.sourceDishIds.push(line.dishId);
    }
    touched.add(id);
  }
  return [...touched].map((id) => items.get(id)!);
}

/** The list as text to share (WhatsApp, SMS…): unticked items, grouped as on screen. */
export function shareLines(items: { name: string; amountLabel: string | null; checked: boolean }[]): string {
  return items
    .filter((i) => !i.checked)
    .map((i) => `• ${i.amountLabel ? `${i.amountLabel} ` : ""}${i.name}`)
    .join("\n");
}
