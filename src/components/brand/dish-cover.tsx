import { useId } from "react";

import type { Course } from "@/lib/dishes";
import { cn } from "@/lib/utils";

import { COOKY_ICON_PATH } from "./brand-icon-path";

/**
 * Each course is laid in its own colourway of the Cooky brand mark,
 * all from theme tokens: covers follow the person's accent and
 * theme, and a box of dishes reads with brand identity rather than blank cards.
 */
const COLOURWAYS: Record<Course, { ground: string; icon: string }> = {
  main: { ground: "fill-tile", icon: "fill-primary" },
  appetizer: { ground: "fill-primary", icon: "fill-tile" },
  side: { ground: "fill-secondary", icon: "fill-tile" },
  dessert: { ground: "fill-primary", icon: "fill-card" },
  drinks: { ground: "fill-tile", icon: "fill-card" },
};

/** Small, stable number from a name, so two dishes of one course don't lay their tiles identically. */
function shift(seed: string, tile: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % tile;
}

type DishCoverProps = {
  /** A signed photo link; without one, the course's tile shows instead. */
  photoUrl: string | null;
  course: Course;
  /** Seeds the tile offset (the dish name or id). */
  seed: string;
  /** "band": a short strip across a card · "photo": 4:3 · "thumb": a square. */
  shape?: "band" | "photo" | "thumb";
  /** Load the photo at once (first cards on screen). */
  eager?: boolean;
  className?: string;
};

const SHAPES = {
  band: "h-16 w-full rounded-2xl",
  photo: "aspect-[4/3] w-full rounded-2xl",
  thumb: "size-16 shrink-0 rounded-xl",
} as const;

/**
 * A dish's picture: its photo when there is one, otherwise a tiled cover with the
 * Cooky brand mark in the colours of its course. Always decorative (the dish name carries the meaning).
 */
export function DishCover({ photoUrl, course, seed, shape = "band", eager = false, className }: DishCoverProps) {
  const id = useId();
  // A photo always gets room to be seen; the tile can stay a slim band.
  const frame = cn(SHAPES[photoUrl && shape === "band" ? "photo" : shape], "overflow-hidden bg-muted", className);

  if (photoUrl)
    return (
      // A plain <img>: signed URLs change on every render, so next/image can't cache them.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={shape === "thumb" ? 64 : 480}
        height={shape === "thumb" ? 64 : 360}
        loading={eager ? "eager" : "lazy"}
        className={cn(frame, "object-cover")}
      />
    );

  // Drawn in tile units, scaled so the cover's height holds whole marks: one row in a band, four in a thumbnail.
  const tile = shape === "thumb" ? 32 : 64;
  const viewBox = shape === "thumb" ? "0 0 64 64" : "0 0 1280 64";
  const colours = COLOURWAYS[course];
  const offset = shift(seed, tile);
  return (
    <div aria-hidden="true" className={cn(frame, "ring-1 ring-foreground/10 ring-inset")}>
      <svg focusable="false" viewBox={viewBox} preserveAspectRatio="xMinYMid slice" className="block size-full">
        <defs>
          <pattern
            id={id}
            width={tile}
            height={tile}
            x={offset}
            patternUnits="userSpaceOnUse"
            viewBox="0 0 1024 1024"
          >
            <rect width={1024} height={1024} className={colours.ground} />
            <g transform="translate(124, 64) scale(0.75)">
              <path
                d={COOKY_ICON_PATH}
                fillRule="evenodd"
                className={cn(colours.icon, "opacity-90")}
              />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
