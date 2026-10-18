import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { RequestLinkForm } from "@/components/auth/request-link-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link href="/login" className="font-medium text-primary-strong underline underline-offset-4">
          {t("backToLogin")}
        </Link>
      }
    >
      <RequestLinkForm purpose="reset" />
    </AuthCard>
  );
}
