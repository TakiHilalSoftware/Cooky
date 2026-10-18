import type { ReactNode } from "react";

import type { AccountSummaryDto } from "@/server/features/account/dto";

import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";
import { TopBar } from "./top-bar";

type PublicShellProps = {
  children: ReactNode;
  /** See TopBar: null = signed out, undefined = unknown. */
  account?: AccountSummaryDto | null;
};

/** Frame for public pages and their 404/error states, so they share one header. */
export function PublicShell({ children, account }: PublicShellProps) {
  return (
    <>
      <SkipLink />
      <TopBar account={account} />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
    </>
  );
}
