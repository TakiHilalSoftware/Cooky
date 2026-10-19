"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { wipeOffline } from "@/components/offline/store";
import { PasswordInput } from "@/components/forms/password-input";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/server/actions/auth";
import { requestAccountDeletion } from "@/server/actions/account";

import { SettingsSection } from "./settings-section";

/**
 * Delete account (PRD §3.1): a 7-day grace, the subscription cancelled first,
 * and a password (or a fresh login for Google/Apple accounts) to confirm.
 * Irreversible once the grace ends, so it's the one place with a confirm dialog.
 */
export function DeleteAccountCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("yourData.delete");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pending, setPending] = useState(false);

  function close(next: boolean) {
    if (!next) {
      setPassword("");
      setError(null);
      setNeedsLogin(false);
    }
    setOpen(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasPassword && !password) return setError(t("passwordRequired"));
    setPending(true);
    const result = await requestAccountDeletion({ password: hasPassword ? password : undefined });
    setPending(false);
    const status = result?.data?.status;
    if (status === "scheduled") {
      // The account is signed out everywhere now; this device forgets its offline copy too.
      await wipeOffline();
      toast.success(t("scheduled"), { duration: 10_000 });
      router.replace("/");
      router.refresh();
      return;
    }
    if (status === "wrong_password") return setError(t("wrongPassword"));
    if (status === "password_required") return setError(t("passwordRequired"));
    if (status === "login_again") return setNeedsLogin(true);
    setError(messages.action(result?.serverError));
  }

  return (
    <SettingsSection
      title={t("heading")}
      description={t("description")}
      className="border-destructive/40"
      aside={
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2Icon aria-hidden="true" data-icon="inline-start" />
          {t("open")}
        </Button>
      }
    >
      <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
        <li>{t("pointGrace")}</li>
        <li>{t("pointBilling")}</li>
        <li>{t("pointData")}</li>
      </ul>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">{t("confirmTitle")}</DialogTitle>
              <DialogDescription>{t("confirmBody")}</DialogDescription>
            </DialogHeader>
            {needsLogin ? (
              <div className="space-y-3 rounded-2xl bg-muted p-3 text-sm">
                <p>{t("loginAgain")}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await signOut();
                    await wipeOffline();
                    router.replace("/login?next=/settings/data");
                  }}
                >
                  {t("loginAgainButton")}
                </Button>
              </div>
            ) : hasPassword ? (
              <div className="grid gap-2">
                <Label htmlFor="delete-password">{t("passwordLabel")}</Label>
                <PasswordInput
                  id="delete-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "delete-error" : undefined}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("socialConfirm")}</p>
            )}
            {error ? (
              <p id="delete-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {tCommon("cancel")}
              </Button>
              {needsLogin ? null : (
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {t("confirm")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
