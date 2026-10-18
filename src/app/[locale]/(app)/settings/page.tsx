import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getAccountSummary } from "@/server/features/account/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const account = await getAccountSummary();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-4xl">{t("title")}</h1>
      <section aria-labelledby="account-heading" className="space-y-2 rounded-3xl border border-border bg-card p-6">
        <h2 id="account-heading" className="font-heading text-xl">
          {t("accountHeading")}
        </h2>
        <p className="text-muted-foreground">{t("signedInAs", { email: account?.email ?? "" })}</p>
      </section>
    </div>
  );
}
