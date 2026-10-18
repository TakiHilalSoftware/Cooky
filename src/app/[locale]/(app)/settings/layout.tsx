import { getTranslations } from "next-intl/server";

import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: LayoutProps<"/[locale]/settings">) {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 font-heading text-4xl">{t("title")}</h1>
      <div className="grid gap-6 lg:grid-cols-[12rem_1fr] lg:gap-10">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
