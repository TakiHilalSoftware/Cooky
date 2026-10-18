import type { ReactNode } from "react";

import { ZelligeStar } from "@/components/brand/zellige-star";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  /** One sentence: what this place is for, or what happened. */
  description: string;
  /** The next step. PRD §3.10: every empty state offers one. */
  action: ReactNode;
  /** Defaults to the Cooky star. */
  illustration?: ReactNode;
  /** Heading level, so the state fits the page outline. */
  headingLevel?: 1 | 2 | 3;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
  illustration,
  headingLevel = 2,
  className,
  children,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <Empty className={cn("gap-6", className)}>
      <EmptyHeader className="max-w-md gap-3">
        <EmptyMedia>{illustration ?? <ZelligeStar className="size-16" />}</EmptyMedia>
        <Heading data-slot="empty-title" className="font-heading text-2xl text-balance sm:text-3xl">
          {title}
        </Heading>
        <EmptyDescription className="text-base">{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-3">{action}</EmptyContent>
      {children}
    </Empty>
  );
}
