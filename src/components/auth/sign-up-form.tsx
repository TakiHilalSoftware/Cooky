"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState, type FormEvent } from "react";

import { focusFirstInvalid } from "@/components/forms/focus-first-invalid";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { checkFields, type FieldErrorKeys } from "@/lib/forms";
import { signUp } from "@/server/actions/auth";
import { signUpSchema } from "@/server/features/auth/schema";

import { CheckEmail } from "./check-email";

export function SignUpForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState({ name: "", email: "", password: "", acceptTerms: false });
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const [submitted, setSubmitted] = useState(false);
  // The normalised address the server used, shown back on the "check your email" panel.
  const [sentTo, setSentTo] = useState("");
  const action = useAction(signUp);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    // After a first attempt, re-check as the person fixes things.
    if (submitted) {
      const check = checkFields(signUpSchema, { ...next, locale });
      setErrors(check.ok ? {} : check.errors);
    }
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const check = checkFields(signUpSchema, { ...values, locale });
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstInvalid(formRef.current, check.errors);
      return;
    }
    setErrors({});
    setSentTo(check.data.email);
    action.execute(check.data);
  }

  if (action.result.data?.status === "check_email") {
    return <CheckEmail email={sentTo} onChangeEmail={() => action.reset()} />;
  }

  const compromised = action.result.data?.status === "password_compromised";
  const consentId = "signup-consent";

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-5">
      {action.result.serverError ? (
        <FormAlert tone="error">{messages.action(action.result.serverError)}</FormAlert>
      ) : null}
      <TextField
        label={t("nameLabel")}
        hint={t("nameHint")}
        name="name"
        autoComplete="name"
        value={values.name}
        onChange={(e) => set("name", e.target.value)}
        error={messages.field(errors.name)}
      />
      <TextField
        label={t("emailLabel")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        dir="ltr"
        value={values.email}
        onChange={(e) => set("email", e.target.value)}
        error={messages.field(errors.email)}
      />
      <TextField
        label={t("passwordLabel")}
        hint={t("passwordHint")}
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(e) => set("password", e.target.value)}
        error={compromised ? t("compromised") : messages.field(errors.password)}
        renderInput={(props) => <PasswordInput {...props} />}
      />
      <Field orientation="horizontal" data-invalid={errors.acceptTerms ? true : undefined}>
        <Checkbox
          id={consentId}
          data-field="acceptTerms"
          checked={values.acceptTerms}
          onCheckedChange={(checked) => set("acceptTerms", checked === true)}
          aria-invalid={errors.acceptTerms ? true : undefined}
          aria-describedby={errors.acceptTerms ? `${consentId}-error` : undefined}
        />
        <div className="space-y-1">
          <FieldLabel htmlFor={consentId} className="inline font-normal">
            {t.rich("consent", {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  {chunks} <span className="sr-only">({tCommon("opensInNewTab")})</span>
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  {chunks} <span className="sr-only">({tCommon("opensInNewTab")})</span>
                </Link>
              ),
            })}
          </FieldLabel>
          {errors.acceptTerms ? (
            <FieldError id={`${consentId}-error`}>{messages.field(errors.acceptTerms)}</FieldError>
          ) : null}
        </div>
      </Field>
      <SubmitButton pending={action.isPending} pendingLabel={t("signUp.submitting")}>
        {t("signUp.submit")}
      </SubmitButton>
    </form>
  );
}
