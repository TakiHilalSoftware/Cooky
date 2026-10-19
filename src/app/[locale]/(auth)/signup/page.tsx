import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Link, redirect } from "@/i18n/navigation";
import { SOCIAL_PROVIDERS } from "@/server/auth/auth";
import { getAccountSummary } from "@/server/features/account/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("submit") };
}

export default async function SignUpPage() {
  if (await getAccountSummary()) return redirect({ href: HOME_AFTER_SIGN_IN, locale: await getLocale() });
  const t = await getTranslations("auth.signUp");
  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary-strong underline underline-offset-4">
            {t("logInLink")}
          </Link>
        </>
      }
    >
      <SignUpForm providers={SOCIAL_PROVIDERS} />
    </AuthCard>
  );
}
