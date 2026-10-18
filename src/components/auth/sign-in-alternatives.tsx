"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { AppleMark, GoogleMark } from "@/components/brand/provider-icons";
import { FormAlert } from "@/components/forms/form-alert";
import { useWebAuthnSupport } from "@/components/security/use-webauthn-support";
import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { startSocialSignIn } from "@/server/actions/auth";
import type { SocialProviderId } from "@/server/features/auth/dto";

import { PasskeyLoginButton } from "./passkey-login-button";

const MARK = { google: GoogleMark, apple: AppleMark } as const;

type SignInAlternativesProps = {
  /** Configured providers only (from the server). */
  providers: readonly SocialProviderId[];
  next?: string;
  /** Log in with an existing passkey (not offered on sign-up). */
  withPasskey?: boolean;
  /** On sign-up, say that continuing with a provider accepts the terms. */
  withConsent?: boolean;
};

/** Google/Apple and passkey sign-in, then "or" before the email form. */
export function SignInAlternatives({ providers, next, withPasskey, withConsent }: SignInAlternativesProps) {
  const t = useTranslations();
  const locale = useLocale();
  const passkeys = useWebAuthnSupport() && withPasskey;
  const [working, setWorking] = useState<SocialProviderId | null>(null);
  const [failed, setFailed] = useState(false);
  const start = useAction(startSocialSignIn);

  if (providers.length === 0 && !passkeys) return null;

  async function continueWith(provider: SocialProviderId) {
    setFailed(false);
    setWorking(provider);
    const result = await start.executeAsync({ provider, next, locale });
    if (result.data?.url) {
      // Leaves Cooky for the provider's page; it sends the person back signed in.
      window.location.assign(result.data.url);
      return;
    }
    setWorking(null);
    setFailed(true);
  }

  return (
    <div className="space-y-3">
      {failed ? <FormAlert tone="error">{t("auth.social.failed")}</FormAlert> : null}
      {providers.map((provider) => {
        const Mark = MARK[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={working !== null}
            onClick={() => continueWith(provider)}
          >
            {working === provider ? <Spinner data-icon="inline-start" /> : <Mark className="size-5" />}
            {working === provider ? t("auth.social.working") : t(`auth.social.${provider}`)}
          </Button>
        );
      })}
      {withConsent && providers.length > 0 ? (
        <p className="text-center text-xs text-pretty text-muted-foreground">
          {t.rich("auth.social.consent", {
            terms: (chunks) => (
              <Link href="/terms" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : null}
      {passkeys ? <PasskeyLoginButton next={next} /> : null}
      <div className="pt-2">
        <FieldSeparator>{t("common.or")}</FieldSeparator>
      </div>
    </div>
  );
}
