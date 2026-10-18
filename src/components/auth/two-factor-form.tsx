"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type FormEvent } from "react";

import { CodeInput } from "@/components/forms/code-input";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { checkFields } from "@/lib/forms";
import { verifyBackupCode, verifyTwoFactorCode } from "@/server/actions/auth";
import type { TwoFactorCodeResult } from "@/server/features/security/dto";
import { backupCodeSignInSchema, twoFactorSignInSchema } from "@/server/features/security/schema";

/** The 10-minute window to finish signing in has passed. */
export function TwoFactorExpired() {
  const t = useTranslations("auth.twoFactor");
  return (
    <div className="space-y-5">
      <FormAlert tone="error">{t("expired")}</FormAlert>
      <Button asChild size="lg" className="w-full">
        <Link href="/login">{t("startOver")}</Link>
      </Button>
    </div>
  );
}

/** Second step of signing in: an authenticator code, or a backup code. */
export function TwoFactorForm({ next }: { next?: string }) {
  const t = useTranslations("auth.twoFactor");
  const messages = useFormMessages();
  const locale = useLocale();
  const trustId = useId();
  const [mode, setMode] = useState<"app" | "backup">("app");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const app = useAction(verifyTwoFactorCode);
  const backupAction = useAction(verifyBackupCode);
  const action = mode === "app" ? app : backupAction;

  function submit(value = code) {
    if (mode === "app") {
      const check = checkFields(twoFactorSignInSchema, { code: value, trustDevice, next, locale });
      if (!check.ok) return setFieldError(messages.field(check.errors.code));
      setFieldError(null);
      app.execute(check.data);
    } else {
      const check = checkFields(backupCodeSignInSchema, { code: backup, next, locale });
      if (!check.ok) return setFieldError(messages.field(check.errors.code));
      setFieldError(null);
      backupAction.execute(check.data);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  const result: TwoFactorCodeResult | undefined = action.result.data;
  if (result?.status === "expired") return <TwoFactorExpired />;

  const failure =
    result?.status === "invalid_code"
      ? mode === "app"
        ? t("invalidCode")
        : t("invalidBackup")
      : result?.status === "locked"
        ? t("locked")
        : null;

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      {failure ? <FormAlert tone="error">{failure}</FormAlert> : null}
      {action.result.serverError ? (
        <FormAlert tone="error">{messages.action(action.result.serverError)}</FormAlert>
      ) : null}

      {mode === "app" ? (
        <TextField
          label={t("codeLabel")}
          name="code"
          error={fieldError}
          renderInput={(props) => (
            <CodeInput
              {...props}
              autoFocus
              value={code}
              onValueChange={(value) => {
                setCode(value);
                // Six digits typed or pasted: verify without an extra tap.
                if (value.length === 6 && !app.isPending) submit(value);
              }}
            />
          )}
        />
      ) : (
        <TextField
          label={t("backupLabel")}
          name="code"
          autoComplete="one-time-code"
          spellCheck={false}
          autoFocus
          dir="ltr"
          className="font-mono"
          value={backup}
          onChange={(e) => setBackup(e.target.value)}
          error={fieldError}
        />
      )}

      {mode === "app" ? (
        <Field orientation="horizontal">
          <Checkbox
            id={trustId}
            checked={trustDevice}
            onCheckedChange={(checked) => setTrustDevice(checked === true)}
          />
          <div className="space-y-0.5">
            <FieldLabel htmlFor={trustId} className="font-normal">
              {t("trustDevice")}
            </FieldLabel>
            <FieldDescription>{t("trustDeviceHint")}</FieldDescription>
          </div>
        </Field>
      ) : null}

      <SubmitButton pending={action.isPending} pendingLabel={t("submitting")}>
        {t("submit")}
      </SubmitButton>

      <Button
        type="button"
        variant="link"
        className="w-full"
        onClick={() => {
          setMode(mode === "app" ? "backup" : "app");
          setFieldError(null);
          app.reset();
          backupAction.reset();
        }}
      >
        {mode === "app" ? t("useBackup") : t("useApp")}
      </Button>
    </form>
  );
}
