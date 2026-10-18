import { useFormatter, useTranslations } from "next-intl";

import type { Unit } from "@/lib/dishes";

/** Labels and amounts for dishes, worded the same way on every screen. */
export function useDishCopy() {
  const t = useTranslations("dishes");
  const format = useFormatter();
  return {
    t,
    /** "500 g", "2 cloves", "1.5" (no unit), or null for "to taste". */
    amount: (amount: number | null, unit: Unit | null) => {
      if (amount === null) return null;
      return unit ? t(`unitAmount.${unit}`, { count: amount }) : format.number(amount, { maximumFractionDigits: 2 });
    },
  };
}
