"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { UpgradeSheetProvider } from "@/components/paywall/upgrade-sheet-provider";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import type { ThemePreference } from "@/lib/appearance";

import { InstallProvider } from "@/components/pwa/install-provider";
import { PreferencesSync } from "./preferences-sync";
import { TimeZoneSync } from "./time-zone-sync";

type ProvidersProps = {
  children: ReactNode;
  dir: "ltr" | "rtl";
  /** CSP nonce for next-themes' pre-paint script. */
  nonce: string | undefined;
  /** The signed-in person's saved theme, or null when signed out. */
  savedTheme: ThemePreference | null;
};

/** UI-only providers: theme, text direction for Radix, tooltips, toasts, upgrade sheet, and PWA install. */
export function Providers({ children, dir, nonce, savedTheme }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      <PreferencesSync savedTheme={savedTheme}>
        <DirectionProvider dir={dir}>
          <TooltipProvider delayDuration={300}>
            <UpgradeSheetProvider>
              <InstallProvider>{children}</InstallProvider>
            </UpgradeSheetProvider>
            <TimeZoneSync />
            <Toaster dir={dir} position="bottom-center" />
          </TooltipProvider>
        </DirectionProvider>
      </PreferencesSync>
    </ThemeProvider>
  );
}
