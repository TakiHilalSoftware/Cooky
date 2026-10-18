import { cn } from "@/lib/utils";

import { ZelligeStar } from "./zellige-star";

/** Wordmark. "Cooky" is a brand name, so it stays in Latin script in every locale. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ZelligeStar className="size-7" />
      <span className="font-heading text-xl leading-none tracking-tight" dir="ltr">
        Cooky
      </span>
    </span>
  );
}
