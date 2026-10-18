"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkFields } from "@/lib/forms";
import { confirmPasswordSchema } from "@/server/features/security/schema";

type PasswordConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  /**
   * Resolves to an error message to show, or null on success. On success the
   * parent decides what comes next (close, or open the following step).
   */
  onConfirm: (password: string) => Promise<string | null>;
  destructive?: boolean;
};

/** "Confirm your password" before a sensitive change (2FA, backup codes). */
export function PasswordConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onConfirm,
  destructive,
}: PasswordConfirmDialogProps) {
  const t = useTranslations();
  const messages = useFormMessages();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setPassword("");
    setFieldError(null);
    setError(null);
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(confirmPasswordSchema, { password });
    if (!check.ok) {
      setFieldError(messages.field(check.errors.password));
      return;
    }
    setFieldError(null);
    setPending(true);
    const problem = await onConfirm(check.data.password).finally(() => setPending(false));
    if (problem) setError(problem);
    else reset();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form noValidate onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          <TextField
            label={t("settings.security.twoFactor.passwordLabel")}
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldError}
            renderInput={(props) => <PasswordInput {...props} />}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => close(false)}>
              {t("common.cancel")}
            </Button>
            <SubmitButton
              pending={pending}
              pendingLabel={t("settings.security.twoFactor.checking")}
              variant={destructive ? "destructive" : "default"}
              className="w-full sm:w-auto"
            >
              {submitLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
