"use client";

import { useId } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Chips for one choice (difficulty) or several (seasons, diet), announced as a labelled group. */
export function ChipGroup({
  label,
  hint,
  type,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  type: "single" | "multiple";
  value: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const items = options.map((o) => (
    <ToggleGroupItem
      key={o.value}
      value={o.value}
      className="h-10 rounded-full! border-border px-4 data-[state=on]:border-primary-strong data-[state=on]:bg-primary data-[state=on]:text-primary-foreground pointer-coarse:h-11"
    >
      {o.label}
    </ToggleGroupItem>
  ));
  const common = {
    "aria-labelledby": id,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    variant: "outline" as const,
    spacing: 2,
    className: "flex-wrap",
  };
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      {type === "single" ? (
        // Radix sends "" when the active chip is clicked again; a single choice stays chosen.
        <ToggleGroup {...common} type="single" value={value[0] ?? ""} onValueChange={(v) => v && onChange([v])}>
          {items}
        </ToggleGroup>
      ) : (
        <ToggleGroup {...common} type="multiple" value={value} onValueChange={onChange}>
          {items}
        </ToggleGroup>
      )}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
