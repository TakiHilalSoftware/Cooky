import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import { makeQueryClient } from "@/components/query/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppLocale } from "@/i18n/routing";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const CATALOGS = { en, fr, ar } as const;

/** A fresh cache per test with the app's defaults, except that failures surface at once instead of after retries. */
export function testQueryClient() {
  const client = makeQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  return client;
}

/**
 * Renders with the real message catalog, so tests assert on shipped copy,
 * inside the signed-in shell's providers (tooltips, a query cache).
 */
export function renderWithIntl(
  ui: ReactElement,
  {
    locale = "en",
    queryClient = testQueryClient(),
    ...options
  }: RenderOptions & { locale?: AppLocale; queryClient?: QueryClient } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export { CATALOGS };
