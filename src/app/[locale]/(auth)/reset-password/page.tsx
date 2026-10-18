import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetLinkExpired, ResetPasswordForm } from "@/components/auth/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

const linkParams = z.object({
  token: z.string().min(1).max(512).optional().catch(undefined),
  error: z.string().optional(),
});

/** Better Auth redirects here with `?token=` (valid link) or `?error=INVALID_TOKEN`. */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/[locale]/reset-password">) {
  const { token, error } = linkParams.parse(await searchParams);
  const t = await getTranslations("auth.reset");
  const usable = token && !error;
  return (
    <AuthCard title={usable ? t("title") : t("invalidTitle")} subtitle={usable ? t("subtitle") : undefined}>
      {usable ? <ResetPasswordForm token={token} /> : <ResetLinkExpired />}
    </AuthCard>
  );
}
