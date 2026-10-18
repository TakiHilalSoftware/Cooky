"use client";

import { CheckIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Decorative preview (swatch, icon, sample text); the label carries the meaning. */
  visual: ReactNode;
};

type ChoiceGroupProps<T extends string> = {
  legend: string;
  value: T;
  onValueChange: (value: T) => void;
  choices: readonly Choice<T>[];
  className?: string;
};

/**
 * A radio group shown as tiles: arrow keys move between choices, the choice
 * is announced by its label, and the selected tile is marked by more than
 * colour (ring + check).
 */
export function ChoiceGroup<T extends string>({
  legend,
  value,
  onValueChange,
  choices,
  className,
}: ChoiceGroupProps<T>) {
  const legendId = useId();
  return (
    <div className="space-y-2.5">
      <p id={legendId} className="text-sm font-medium">
        {legend}
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby={legendId}
        value={value}
        onValueChange={(next) => {
          const choice = choices.find((c) => c.value === next);
          if (choice) onValueChange(choice.value);
        }}
        className={cn("grid gap-2", className)}
      >
        {choices.map((choice) => (
          <RadioGroupPrimitive.Item
            key={choice.value}
            value={choice.value}
            aria-label={choice.label}
            className={cn(
              "group relative flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-2 py-3 text-sm transition-colors outline-none",
              "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              "data-[state=checked]:border-primary-strong data-[state=checked]:ring-2 data-[state=checked]:ring-primary-strong",
            )}
          >
            <span aria-hidden="true">{choice.visual}</span>
            <span aria-hidden="true" className="text-center leading-tight">
              {choice.label}
            </span>
            <CheckIcon
              aria-hidden="true"
              className="absolute end-1.5 top-1.5 hidden size-3.5 text-primary-strong group-data-[state=checked]:block"
            />
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
