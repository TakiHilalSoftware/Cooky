import { cn } from "@/lib/utils";

import { starPath } from "./star-path";

const STAR = starPath(12, 12, 11);
const HEART = starPath(12, 12, 4.2);

type ZelligeStarProps = React.ComponentProps<"svg">;

/** Cooky's mark: an eight-point star with a small inlaid centre. Decorative. */
export function ZelligeStar({ className, ...props }: ZelligeStarProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("size-6", className)} {...props}>
      <path d={STAR} className="fill-primary" />
      <path d={HEART} className="fill-tile" />
    </svg>
  );
}
