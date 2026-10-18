"use client";

import { MailCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState, type FormEvent } from "react";

import { focusFirstInvalid } from "@/components/forms/focus-first-invalid";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { checkFields, type FieldErrorKeys } from "@/lib/forms";
import { requestPasswordReset, resendVerification } from "@/server/actions/auth";
import { emailOnlySchema } from "@/server/features/auth/schema";

type RequestLinkFormProps = {
  /** Which link to email: a password reset, or a fresh confirmation link. */
  purpose: "reset" | "verify";
};

/** "Enter your email and we'll send you a link", for password reset and re-verification. */
export function RequestLinkForm({ purpose }: RequestLinkFormProps) {
  const t = useTranslations("auth");
  // The "sent" copy never confirms whether an account exists.
  const copy =
    purpose === "reset"
      ? {
          submit: t("forgot.submit"),
          pending: t("forgot.submitting"),
          sentTitle: t("forgot.sentTitle"),
          sentBody: (email: string) => t("forgot.sentBody", { email }),
        }
      : {
          submit: t("verified.sendNew"),
          pending: t("forgot.submitting"),
          sentTitle: t("verified.sentTitle"),
          sentBody: (email: string) => t("verified.sentBody", { email }),
        };
  const messages = useFormMessages();
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const [sentTo, setSentTo] = useState("");
  const action = useAction(purpose === "reset" ? requestPasswordReset : resendVerification);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(emailOnlySchema, { email, locale });
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstInvalid(formRef.current, check.errors);
      return;
    }
    setErrors({});
    setSentTo(check.data.email);
    action.execute(check.data);
  }

  if (action.result.data?.status === "sent") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-muted p-4">
        <MailCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-strong" />
        <div className="space-y-1">
          <p className="font-medium">{copy.sentTitle}</p>
          <p className="text-sm text-pretty text-muted-foreground">{copy.sentBody(sentTo)}</p>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-5">
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
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={messages.field(errors.email)}
      />
      <SubmitButton pending={action.isPending} pendingLabel={copy.pending}>
        {copy.submit}
      </SubmitButton>
    </form>
  );
}
