import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppLocale } from "@/i18n/routing";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const CATALOGS = { en, fr, ar } as const;

/** Renders with the real message catalog, so tests assert on shipped copy. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en", ...options }: RenderOptions & { locale?: AppLocale } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export { CATALOGS };
