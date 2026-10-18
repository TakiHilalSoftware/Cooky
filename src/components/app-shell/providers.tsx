"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { TimeZoneSync } from "./time-zone-sync";

type ProvidersProps = {
  children: ReactNode;
  dir: "ltr" | "rtl";
  /** CSP nonce for next-themes' pre-paint script. */
  nonce: string | undefined;
};

/** UI-only providers: theme, text direction for Radix, tooltips and toasts. */
export function Providers({ children, dir, nonce }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      <DirectionProvider dir={dir}>
        <TooltipProvider delayDuration={300}>
          {children}
          <TimeZoneSync />
          <Toaster dir={dir} position="bottom-center" />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
