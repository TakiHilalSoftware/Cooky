import { Readex_Pro, Reem_Kufi } from "next/font/google";

// Self-hosted at build time by next/font: no request to Google at runtime.
// Both families cover Latin (incl. French œ) and Arabic, so the three
// languages share one typographic voice.
export const bodyFont = Readex_Pro({
  subsets: ["latin", "latin-ext", "arabic"],
  variable: "--font-body",
  display: "swap",
});

export const displayFont = Reem_Kufi({
  subsets: ["latin", "latin-ext", "arabic"],
  variable: "--font-display",
  display: "swap",
});
