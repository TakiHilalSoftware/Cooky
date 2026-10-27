import { useId } from "react";

import { COOKY_ICON_PATH } from "@/components/brand/brand-icon-path";
import { cn } from "@/lib/utils";

const TILE = 72;

/**
 * Tile panel laid with Cooky's brand mark in a repeating grid.
 * Follows the user's accent and theme. Purely decorative.
 */
export function TilePanel({ className }: { className?: string }) {
  const id = useId();
  return (
    <div className={cn("overflow-hidden rounded-[2rem] bg-tile shadow-sm ring-1 ring-foreground/10", className)}>
      <svg aria-hidden="true" focusable="false" className="block size-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern
            id={id}
            width={TILE}
            height={TILE}
            patternUnits="userSpaceOnUse"
            viewBox="0 0 1024 1024"
          >
            <rect width={1024} height={1024} className="fill-tile" />
            <g transform="translate(124, 64) scale(0.75)">
              <path d={COOKY_ICON_PATH} fillRule="evenodd" className="fill-primary" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
