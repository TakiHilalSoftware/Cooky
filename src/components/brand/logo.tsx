import { cn } from "@/lib/utils";

import { ZelligeStar } from "./zellige-star";

/** Wordmark. "Cooky" is a brand name, so it stays in Latin script in every locale. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ZelligeStar className="size-7" />
      {/* On very narrow phones the star alone carries the brand, leaving room for the controls. */}
      <span className="font-heading text-xl leading-none tracking-tight max-[380px]:hidden" dir="ltr">
        Cooky
      </span>
    </span>
  );
}
