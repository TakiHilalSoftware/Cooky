"use client";

import { CircleCheckIcon, TimerOffIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState, type FormEvent } from "react";

import { focusFirstInvalid } from "@/components/forms/focus-first-invalid";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { checkFields, type FieldErrorKeys } from "@/lib/forms";
import { resetPassword } from "@/server/actions/auth";
import { resetPasswordSchema } from "@/server/features/auth/schema";

/** Shown when a reset link is missing, already used, or expired. */
export function ResetLinkExpired() {
  const t = useTranslations("auth.reset");
  return (
    <div className="space-y-5">
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-muted p-4">
        <TimerOffIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium">{t("invalidTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("invalidBody")}</p>
        </div>
      </div>
      <Button asChild size="lg" className="w-full">
        <Link href="/forgot-password">{t("requestNew")}</Link>
      </Button>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const messages = useFormMessages();
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const action = useAction(resetPassword);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(resetPasswordSchema, { token, password, locale });
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstInvalid(formRef.current, check.errors);
      return;
    }
    setErrors({});
    action.execute(check.data);
  }

  const status = action.result.data?.status;
  if (status === "invalid_token") return <ResetLinkExpired />;
  if (status === "reset") {
    return (
      <div className="space-y-5">
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-muted p-4">
          <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-strong" />
          <div className="space-y-1">
            <p className="font-medium">{t("reset.doneTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("reset.doneBody")}</p>
          </div>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">{t("reset.logIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-5">
      {action.result.serverError ? (
        <FormAlert tone="error">{messages.action(action.result.serverError)}</FormAlert>
      ) : null}
      <TextField
        label={t("newPasswordLabel")}
        hint={t("passwordHint")}
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={status === "password_compromised" ? t("compromised") : messages.field(errors.password)}
        renderInput={(props) => <PasswordInput {...props} />}
      />
      <SubmitButton pending={action.isPending} pendingLabel={t("reset.submitting")}>
        {t("reset.submit")}
      </SubmitButton>
    </form>
  );
}
