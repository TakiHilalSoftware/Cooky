import { Spinner } from "@/components/ui/spinner";

/**
 * The small "working on it" note shown over content that is being brought up
 * to date. It fades in after a beat, so a quick answer never flashes it.
 */
export function BusyPill({ label }: { label: string }) {
  return (
    <span className="inline-flex animate-in items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-md delay-150 duration-200 fill-mode-backwards fade-in motion-reduce:animate-none">
      <Spinner className="text-primary-strong" />
      {label}
    </span>
  );
}
