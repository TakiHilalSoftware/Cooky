import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Providers } from "@/components/app-shell/providers";
import { directionOf, routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { bodyFont, displayFont } from "../fonts";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: "metadata",
  });
  return {
    title: { default: t("title"), template: `%s · Cooky` },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121614" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = directionOf(locale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={cn(bodyFont.variable, displayFont.variable)}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir} nonce={nonce}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
