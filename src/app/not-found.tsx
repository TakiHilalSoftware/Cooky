import Link from "next/link";

import { routing } from "@/i18n/routing";

import messages from "../../messages/en.json";

import { bodyFont, displayFont } from "./fonts";

// Only reached for paths the locale proxy skips (e.g. a missing /file.png).
// Locale pages use [locale]/not-found.tsx instead.
export default function RootNotFound() {
  return (
    <html lang={routing.defaultLocale} className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="grid min-h-dvh place-items-center p-6 text-center">
        <main className="max-w-md space-y-4">
          <h1 className="font-heading text-3xl">{messages.notFound.title}</h1>
          <p className="text-muted-foreground">{messages.notFound.description}</p>
          <Link
            href={`/${routing.defaultLocale}`}
            className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
          >
            {messages.common.backToHome}
          </Link>
        </main>
      </body>
    </html>
  );
}
