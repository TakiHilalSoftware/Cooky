import { RotateCcwIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./empty-state";

type ErrorStateProps = {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
  /** Usually "Back to home". */
  secondaryAction?: ReactNode;
  /** What still works, e.g. "Your offline shopping list is still available." */
  stillWorks?: string;
  headingLevel?: 1 | 2 | 3;
};

/**
 * Recoverable error UI (PRD §3.10). It takes copy, not an error object, so
 * raw error text can never be rendered by accident.
 */
export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  secondaryAction,
  stillWorks,
  headingLevel,
}: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      headingLevel={headingLevel}
      action={
        <>
          <Button size="lg" onClick={onRetry}>
            <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
            {retryLabel}
          </Button>
          {secondaryAction}
        </>
      }
    >
      {stillWorks ? <p className="max-w-md text-sm text-muted-foreground">{stillWorks}</p> : null}
    </EmptyState>
  );
}
