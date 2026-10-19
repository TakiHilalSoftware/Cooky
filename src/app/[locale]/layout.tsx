import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Providers } from "@/components/app-shell/providers";
import { directionOf, routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { getAccountSummary } from "@/server/features/account/queries";
import { env } from "@/server/env";
import { getAppearance } from "@/server/features/profile/queries";

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
    // Absolute URLs for share previews (opengraph-image.tsx next to this layout).
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    openGraph: { siteName: "Cooky", type: "website", locale, title: t("title"), description: t("description") },
    twitter: { card: "summary_large_image" },
    icons: { apple: "/icons/apple-touch-icon.png" },
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
  const [appearance, account] = await Promise.all([getAppearance(), getAccountSummary()]);

  return (
    // Accent and text size are rendered on <html> so pages arrive styled (no flash).
    <html
      lang={locale}
      dir={dir}
      data-accent={appearance.accent}
      data-text-size={appearance.textSize}
      suppressHydrationWarning
      className={cn(bodyFont.variable, displayFont.variable)}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir} nonce={nonce} savedTheme={account ? appearance.theme : null}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
