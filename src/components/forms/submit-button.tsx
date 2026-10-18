import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pending: boolean;
  /** What's happening while pending, e.g. "Creating account…". */
  pendingLabel: string;
};

/** Full-width submit that says what it's doing and can't be double-sent. */
export function SubmitButton({ pending, pendingLabel, children, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <Spinner data-icon="inline-start" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
