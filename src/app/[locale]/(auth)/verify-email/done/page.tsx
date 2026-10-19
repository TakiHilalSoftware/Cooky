import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { RequestLinkForm } from "@/components/auth/request-link-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ONBOARDING_PATH } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verified");
  return { title: t("title") };
}

/** Landing page of the confirmation email link; Better Auth adds `?error=` when it failed. */
export default async function VerifyEmailDonePage({ searchParams }: PageProps<"/[locale]/verify-email/done">) {
  const { error } = await searchParams;
  const t = await getTranslations("auth.verified");
  if (error) {
    return (
      <AuthCard title={t("errorTitle")} subtitle={t("errorBody")}>
        <RequestLinkForm purpose="verify" />
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("title")} subtitle={t("body")}>
      <Button asChild size="lg" className="w-full">
        <Link href={ONBOARDING_PATH}>{t("continue")}</Link>
      </Button>
    </AuthCard>
  );
}
