import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading placeholder: a title bar and a few content blocks.
 * `label` is announced to screen readers while sighted users see the shapes.
 */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
