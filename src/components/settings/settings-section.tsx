import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SettingsSectionProps = {
  title: string;
  description: string;
  /** Status or primary action shown next to the heading. */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** One card per setting: what it is, its state, and what you can do. */
export function SettingsSection({ title, description, aside, children, className }: SettingsSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-3xl border border-border bg-card p-5 sm:p-6", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <h2 id={headingId} className="font-heading text-xl">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
