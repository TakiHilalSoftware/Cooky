"use client";
import { useEffect } from "react";

import { directionOf, type AppLocale } from "@/i18n/routing";
import { reportClientError } from "@/lib/report-error";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

import "./globals.css";

const CATALOGS = { en, fr, ar } as const;

// The root layout itself failed, so there's no i18n provider: read the locale
// from the URL and fall back to English.
function pickCatalog(): { locale: AppLocale; messages: (typeof CATALOGS)[AppLocale] } {
  const segment = typeof window === "undefined" ? "" : window.location.pathname.split("/")[1];
  if (segment === "fr" || segment === "ar") return { locale: segment, messages: CATALOGS[segment] };
  return { locale: "en", messages: CATALOGS.en };
}

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  const { locale, messages } = pickCatalog();
  return (
    <html lang={locale} dir={directionOf(locale)}>
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
        <title>{messages.errorPage.title}</title>
        <main className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold">{messages.errorPage.title}</h1>
          <p className="text-muted-foreground">{messages.errorPage.description}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="min-h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground"
            >
              {messages.common.tryAgain}
            </button>
            <a
              href={`/${locale}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-input px-5 font-medium"
            >
              {messages.common.backToHome}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
