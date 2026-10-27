import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { COOKY_ICON_PATH, COOKY_ICON_VIEWBOX } from "./brand-icon-path";

type CookyIconProps = ComponentProps<"svg">;

/** Cooky's brand mark: chef hat with fork and spoon cutouts. Decorative. */
export function CookyIcon({ className, ...props }: CookyIconProps) {
  return (
    <svg
      viewBox={COOKY_ICON_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      className={cn("size-6 fill-primary", className)}
      {...props}
    >
      <path d={COOKY_ICON_PATH} fillRule="evenodd" />
    </svg>
  );
}

/** Backward-compatibility alias for components referencing the mark as ZelligeStar. */
export { CookyIcon as ZelligeStar };
