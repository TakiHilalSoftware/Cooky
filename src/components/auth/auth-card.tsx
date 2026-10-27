import type { ReactNode } from "react";

import { CookyIcon } from "@/components/brand/cooky-icon";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Secondary links under the card ("Already have an account? Log in"). */
  footer?: ReactNode;
};

/** The frame for every sign-in screen: one heading, one job. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:py-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-2">
          <CookyIcon className="mb-4 size-9" />
          <h1 className="font-heading text-3xl text-balance">{title}</h1>
          {subtitle ? <p className="text-pretty text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </div>
      {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
