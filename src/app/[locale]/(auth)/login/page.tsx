import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";

import { AuthCard } from "@/components/auth/auth-card";
import { LogInForm } from "@/components/auth/log-in-form";
import { Link, redirect } from "@/i18n/navigation";
import { SOCIAL_PROVIDERS } from "@/server/auth/auth";
import type { SocialSignInError } from "@/server/features/auth/dto";
import { safeNextPath } from "@/server/features/auth/schema";
import { getAccountSummary } from "@/server/features/account/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.logIn");
  return { title: t("submit") };
}

/** Better Auth sends people back here with `?error=<code>` when Google/Apple sign-in fails. */
function socialError(code: unknown): SocialSignInError | null {
  if (typeof code !== "string" || code.length === 0) return null;
  const normalised = code.toLowerCase();
  if (normalised.includes("not_linked")) return "not_linked";
  if (normalised.includes("ban")) return "suspended";
  return "failed";
}

export default async function LogInPage({ searchParams }: PageProps<"/[locale]/login">) {
  const params = await searchParams;
  const next = safeNextPath.parse(params.next);
  if (await getAccountSummary()) return redirect({ href: next ?? HOME_AFTER_SIGN_IN, locale: await getLocale() });
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
      <LogInForm next={next} providers={SOCIAL_PROVIDERS} socialError={socialError(params.error)} />
    </AuthCard>
  );
}
