import type { ReactNode } from "react";

import "./globals.css";

// <html> and <body> live in [locale]/layout.tsx, which knows lang and dir.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
