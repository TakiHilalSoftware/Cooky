import { CakeSliceIcon, CookingPotIcon, CupSodaIcon, SaladIcon, SoupIcon, type LucideIcon } from "lucide-react";

import type { Course } from "@/lib/dishes";
import { cn } from "@/lib/utils";

/**
 * Without a photo, a dish gets one illustration of its course in that course's
 * colourway, all from theme tokens: covers follow the person's accent and
 * theme, and read as "a soup", "a dessert" rather than as a photo of the dish.
 */
const COURSE_COVERS: Record<Course, { ground: string; ink: string; Icon: LucideIcon }> = {
  main: { ground: "bg-tile", ink: "text-primary", Icon: CookingPotIcon },
  appetizer: { ground: "bg-primary", ink: "text-tile", Icon: SoupIcon },
  side: { ground: "bg-secondary", ink: "text-tile", Icon: SaladIcon },
  dessert: { ground: "bg-primary", ink: "text-card", Icon: CakeSliceIcon },
  drinks: { ground: "bg-tile", ink: "text-card", Icon: CupSodaIcon },
};

/** The light falls from a different corner per dish, so two covers of one course aren't identical. */
const LIGHT = ["bg-linear-to-br", "bg-linear-to-bl", "bg-linear-to-tr", "bg-linear-to-tl"] as const;

/** Small, stable number from a name. */
function shift(seed: string, range: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % range;
}

type DishCoverProps = {
  /** A signed photo link; without one, the course's illustration shows instead. */
  photoUrl: string | null;
  course: Course;
  /** Varies the cover's light (the dish name or id). */
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

const ICON_SIZES = { band: "size-8", photo: "size-16", thumb: "size-7" } as const;

/**
 * A dish's picture: its photo when there is one, otherwise its course's
 * illustration. Always decorative (the dish name carries the meaning).
 */
export function DishCover({ photoUrl, course, seed, shape = "band", eager = false, className }: DishCoverProps) {
  // A photo always gets room to be seen; the illustration can stay a slim band.
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

  const { ground, ink, Icon } = COURSE_COVERS[course];
  return (
    <div
      aria-hidden="true"
      data-cover={course}
      className={cn(frame, ground, "relative grid place-items-center ring-1 ring-foreground/10 ring-inset")}
    >
      <div className={cn("absolute inset-0 from-white/20 to-black/15", LIGHT[shift(seed, LIGHT.length)])} />
      <Icon strokeWidth={1.5} className={cn("relative", ink, ICON_SIZES[shape])} />
    </div>
  );
}
