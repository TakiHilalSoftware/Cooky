"use client";

import { MailCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";

import { FormAlert } from "@/components/forms/form-alert";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { resendVerification } from "@/server/actions/auth";

/** After sign-up: where the link went, and a way out if it didn't arrive. */
export function CheckEmail({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const t = useTranslations("auth.signUp");
  const messages = useFormMessages();
  const locale = useLocale();
  const resend = useAction(resendVerification);

  return (
    <div className="space-y-5" role="status">
      <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
        <MailCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-strong" />
        <div className="space-y-1">
          <p className="font-medium">{t("checkEmailTitle")}</p>
          <p className="text-sm text-pretty text-muted-foreground">{t("checkEmailBody", { email })}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("checkEmailHint")}</p>
      {resend.hasSucceeded ? <FormAlert tone="success">{t("resent")}</FormAlert> : null}
      {resend.result.serverError ? (
        <FormAlert tone="error">{messages.action(resend.result.serverError)}</FormAlert>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={resend.isPending}
          onClick={() => resend.execute({ email, locale })}
        >
          {resend.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t("resend")}
        </Button>
        <Button variant="ghost" size="lg" className="flex-1" onClick={onChangeEmail}>
          {t("useDifferentEmail")}
        </Button>
      </div>
    </div>
  );
}
