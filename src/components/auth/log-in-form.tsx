"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState, type FormEvent } from "react";

import { focusFirstInvalid } from "@/components/forms/focus-first-invalid";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Link } from "@/i18n/navigation";
import { checkFields, type FieldErrorKeys } from "@/lib/forms";
import { signIn } from "@/server/actions/auth";
import type { SocialProviderId, SocialSignInError } from "@/server/features/auth/dto";
import { signInSchema } from "@/server/features/auth/schema";

import { SignInAlternatives } from "./sign-in-alternatives";

/** `next` is where to go after logging in; the server re-validates it. */
type LogInFormProps = {
  /** Where to go after logging in; the server re-validates it. */
  next?: string;
  providers?: readonly SocialProviderId[];
  /** Set when Google/Apple sent the person back without signing them in. */
  socialError?: SocialSignInError | null;
};

export function LogInForm({ next, providers = [], socialError }: LogInFormProps) {
  const t = useTranslations("auth");
  const messages = useFormMessages();
  const format = useFormatter();
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const [sentTo, setSentTo] = useState("");
  const action = useAction(signIn);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(signInSchema, { ...values, next, locale });
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstInvalid(formRef.current, check.errors);
      return;
    }
    setErrors({});
    setSentTo(check.data.email);
    action.execute(check.data);
  }

  const result = action.result.data;
  const status = result?.status;

  return (
    <div className="space-y-5">
      {socialError ? (
        <FormAlert tone="error">
          {socialError === "not_linked"
            ? t("social.notLinked")
            : socialError === "suspended"
              ? t("social.suspended")
              : t("social.failed")}
        </FormAlert>
      ) : null}
      <SignInAlternatives providers={providers} next={next} withPasskey />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-5">
        {result?.status === "locked" ? (
          <FormAlert tone="error">
            {result.retryAt
              ? t("logIn.locked", { time: format.dateTime(new Date(result.retryAt), { timeStyle: "short" }) })
              : t("logIn.lockedGeneric")}
          </FormAlert>
        ) : null}
        {status === "suspended" ? <FormAlert tone="error">{t("logIn.suspended")}</FormAlert> : null}
        {status === "invalid_credentials" ? <FormAlert tone="error">{t("logIn.invalidCredentials")}</FormAlert> : null}
        {status === "verify_email" ? (
          <FormAlert tone="error">{t("logIn.verifyEmail", { email: sentTo })}</FormAlert>
        ) : null}
        {action.result.serverError ? (
          <FormAlert tone="error">{messages.action(action.result.serverError)}</FormAlert>
        ) : null}
        <TextField
          label={t("emailLabel")}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          dir="ltr"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={messages.field(errors.email)}
        />
        <div className="space-y-1">
          <TextField
            label={t("passwordLabel")}
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
            error={messages.field(errors.password)}
            renderInput={(props) => <PasswordInput {...props} />}
          />
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            {t("logIn.forgot")}
          </Link>
        </div>
        <SubmitButton pending={action.isPending} pendingLabel={t("logIn.submitting")}>
          {t("logIn.submit")}
        </SubmitButton>
      </form>
    </div>
  );
}
