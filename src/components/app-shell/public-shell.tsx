import type { ReactNode } from "react";

import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";
import { TopBar } from "./top-bar";

/** Frame for public pages and their 404/error states, so they share one header. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <TopBar />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
    </>
  );
}
