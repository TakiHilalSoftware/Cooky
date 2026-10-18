import { useId } from "react";

import { starPath } from "@/components/brand/star-path";
import { cn } from "@/lib/utils";

const TILE = 72;
const STAR = starPath(TILE / 2, TILE / 2, TILE / 2);
const HEART = starPath(TILE / 2, TILE / 2, TILE / 7);

/**
 * Star-and-cross zellige: eight-point stars touch at their tips, and the gaps
 * between them read as crosses in the tile color. Stars follow the user's
 * accent, so the panel changes with their palette. Purely decorative.
 */
export function TilePanel({ className }: { className?: string }) {
  const id = useId();
  return (
    <div className={cn("overflow-hidden rounded-[2rem] bg-tile shadow-sm ring-1 ring-foreground/10", className)}>
      <svg aria-hidden="true" focusable="false" className="block size-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <path d={STAR} className="fill-primary stroke-background" strokeWidth={2.5} />
            <path d={HEART} className="fill-tile" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
