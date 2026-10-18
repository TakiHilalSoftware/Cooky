"use client";

import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { focusFirstInvalid } from "@/components/forms/focus-first-invalid";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { SettingsSection } from "@/components/settings/settings-section";
import { checkFields, type FieldErrorKeys } from "@/lib/forms";
import { changePassword } from "@/server/actions/security";
import { changePasswordSchema } from "@/server/features/security/schema";

export function ChangePasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings.security.password");
  const tAuth = useTranslations("auth");
  const messages = useFormMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const action = useAction(changePassword, {
    onSuccess: ({ data }) => {
      if (data?.status !== "changed") return;
      setValues({ currentPassword: "", newPassword: "" });
      toast.success(t("changed"));
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(changePasswordSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstInvalid(formRef.current, check.errors);
      return;
    }
    setErrors({});
    action.execute(check.data);
  }

  if (!hasPassword) {
    return <SettingsSection title={t("heading")} description={t("noPassword")} />;
  }

  const status = action.result.data?.status;
  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      <form ref={formRef} noValidate onSubmit={onSubmit} className="max-w-md space-y-5">
        {action.result.serverError ? (
          <FormAlert tone="error">{messages.action(action.result.serverError)}</FormAlert>
        ) : null}
        <TextField
          label={t("currentLabel")}
          name="currentPassword"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => setValues({ ...values, currentPassword: e.target.value })}
          error={status === "wrong_password" ? t("wrongPassword") : messages.field(errors.currentPassword)}
          renderInput={(props) => <PasswordInput {...props} />}
        />
        <TextField
          label={t("newLabel")}
          hint={tAuth("passwordHint")}
          name="newPassword"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => setValues({ ...values, newPassword: e.target.value })}
          error={status === "password_compromised" ? tAuth("compromised") : messages.field(errors.newPassword)}
          renderInput={(props) => <PasswordInput {...props} />}
        />
        <SubmitButton pending={action.isPending} pendingLabel={t("submitting")} className="w-full sm:w-auto">
          {t("submit")}
        </SubmitButton>
      </form>
    </SettingsSection>
  );
}
