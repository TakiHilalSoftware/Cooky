import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";
import { cookies } from "next/headers";

import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorExpired, TwoFactorForm } from "@/components/auth/two-factor-form";
import { redirect } from "@/i18n/navigation";
import { getAccountSummary } from "@/server/features/account/queries";
import { safeNextPath } from "@/server/features/auth/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.twoFactor");
  return { title: t("title") };
}

/** Second sign-in step; reached from the log-in form when the account has 2FA. */
export default async function TwoFactorPage({ searchParams }: PageProps<"/[locale]/two-factor">) {
  const next = safeNextPath.parse((await searchParams).next);
  if (await getAccountSummary()) return redirect({ href: next ?? HOME_AFTER_SIGN_IN, locale: await getLocale() });

  // Better Auth keeps the pending sign-in in a 10-minute cookie ("cooky.two_factor",
  // "__Secure-" prefixed over HTTPS). Without it, the code can't be checked.
  const pending = (await cookies()).getAll().some((cookie) => cookie.name.endsWith("cooky.two_factor"));
  const t = await getTranslations("auth.twoFactor");
  return (
    <AuthCard title={t("title")} subtitle={pending ? t("subtitle") : undefined}>
      {pending ? <TwoFactorForm next={next} /> : <TwoFactorExpired />}
    </AuthCard>
  );
}
