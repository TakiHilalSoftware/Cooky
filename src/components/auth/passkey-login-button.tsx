"use client";

import { startAuthentication, WebAuthnError } from "@simplewebauthn/browser";
import { FingerprintIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useWebAuthnSupport } from "@/components/security/use-webauthn-support";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { passkeyLogin, passkeyLoginOptions } from "@/server/actions/auth";

/** "Log in with a passkey", shown only where the browser supports passkeys. */
export function PasskeyLoginButton({ next }: { next?: string }) {
  const t = useTranslations();
  const messages = useFormMessages();
  const locale = useLocale();
  const supported = useWebAuthnSupport();
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const options = useAction(passkeyLoginOptions);
  const login = useAction(passkeyLogin);

  if (!supported) return null;

  async function logIn() {
    setProblem(null);
    setWorking(true);
    try {
      const prepared = await options.executeAsync();
      if (!prepared.data) return setProblem(messages.action(prepared.serverError));
      let response;
      try {
        response = await startAuthentication({ optionsJSON: prepared.data });
      } catch (error) {
        const cancelled =
          (error instanceof WebAuthnError && error.code === "ERROR_CEREMONY_ABORTED") ||
          (error instanceof DOMException && error.name === "NotAllowedError");
        return setProblem(cancelled ? t("auth.logIn.passkeyCancelled") : t("auth.logIn.passkeyNotRecognised"));
      }
      // On success the action redirects; anything returned is a failure to explain.
      const result = await login.executeAsync({ response, next, locale });
      if (result.data?.status === "not_recognised") setProblem(t("auth.logIn.passkeyNotRecognised"));
      else if (result.serverError) setProblem(messages.action(result.serverError));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-2">
      {problem ? <FormAlert tone="error">{problem}</FormAlert> : null}
      <Button type="button" variant="outline" size="lg" className="w-full" disabled={working} onClick={logIn}>
        {working ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <FingerprintIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {working ? t("auth.logIn.passkeyWorking") : t("auth.logIn.passkey")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("auth.logIn.passkeyHint")}</p>
    </div>
  );
}
