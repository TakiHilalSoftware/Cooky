import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { LogInForm } from "@/components/auth/log-in-form";
import { Link, redirect } from "@/i18n/navigation";
import { safeNextPath } from "@/server/features/auth/schema";
import { getAccountSummary } from "@/server/features/account/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.logIn");
  return { title: t("submit") };
}

export default async function LogInPage({ searchParams }: PageProps<"/[locale]/login">) {
  const next = safeNextPath.parse((await searchParams).next);
  if (await getAccountSummary()) return redirect({ href: next ?? "/settings", locale: await getLocale() });
  const t = await getTranslations("auth.logIn");
  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary-strong underline underline-offset-4">
            {t("signUpLink")}
          </Link>
        </>
      }
    >
      <LogInForm next={next} />
    </AuthCard>
  );
}
