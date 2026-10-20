import { Suspense, type ReactNode } from "react";

import type { AccountSummaryDto } from "@/server/features/account/dto";

import { OfflineSync } from "@/components/offline/offline-sync";
import { QueryProvider } from "@/components/query/query-provider";

import { AppSidebar, BottomNav } from "./app-nav";
import { RealtimeProvider } from "./realtime-provider";
import { RealtimeShell } from "./realtime-shell";
import { RouteFreshness } from "./route-freshness";
import { SiteFooter } from "./site-footer";
import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";
import { TopBar } from "./top-bar";

type PublicShellProps = {
  children: ReactNode;
  /** See TopBar: null = signed out, undefined = unknown. */
  account?: AccountSummaryDto | null;
  weather?: ReactNode;
};

/** Frame for public pages and their 404/error states, so they share one header. */
export function PublicShell({ children, account, weather }: PublicShellProps) {
  // Reads the URL, so it gets its own boundary instead of holding up the page.
  const freshness = (
    <Suspense fallback={null}>
      <RouteFreshness />
    </Suspense>
  );
  const shell = (
    <>
      <SkipLink />
      {/* Unknown on error pages (undefined): leave the device copy alone. */}
      {account !== undefined ? <OfflineSync ownerKey={account?.deviceKey ?? null} /> : null}
      <TopBar account={account} weather={weather} />
      {account ? (
        // Signed in: the app's places beside (desktop) or below (phone) every page, public ones included.
        <RealtimeProvider config={account.realtime}>
          <RealtimeShell />
          <div className="flex flex-1">
            <AppSidebar account={account} />
            <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
              <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">
                {freshness}
                {children}
              </main>
              <SiteFooter account={account} />
            </div>
          </div>
          <BottomNav account={account} />
        </RealtimeProvider>
      ) : (
        <>
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {freshness}
            {children}
          </main>
          <SiteFooter account={account} />
        </>
      )}
    </>
  );
  // One client cache per signed-in account: a new account (or signing out) never sees the last one's data.
  return account ? <QueryProvider key={account.deviceKey}>{shell}</QueryProvider> : shell;
}
