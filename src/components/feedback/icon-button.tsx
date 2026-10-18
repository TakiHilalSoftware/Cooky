"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type IconButtonProps = Omit<ComponentProps<typeof Button>, "aria-label" | "children"> & {
  /** What the button does, in plain words. Becomes the accessible name and the tooltip. */
  label: string;
  /** The icon. Icons are decorative; `label` carries the meaning. */
  children: ReactNode;
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
};

/**
 * The only way to render an icon-only button: `label` is required, so no icon
 * ships without a name for screen readers and a tooltip for everyone else.
 */
export function IconButton({
  label,
  children,
  tooltipSide,
  variant = "ghost",
  size = "icon",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
