"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CodeInput } from "@/components/forms/code-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkFields } from "@/lib/forms";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorSetup,
} from "@/server/actions/security";
import type { TwoFactorSetupDto } from "@/server/features/security/dto";
import { totpCodeSchema } from "@/server/features/security/schema";

import { BackupCodes } from "./backup-codes";
import { PasswordConfirmDialog } from "./password-confirm-dialog";

type Flow = null | "enable-password" | "enable-scan" | "enable-codes" | "disable" | "codes-password" | "codes-show";

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings.security.twoFactor");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const [flow, setFlow] = useState<Flow>(null);
  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const start = useAction(startTwoFactorSetup);
  const confirm = useAction(confirmTwoFactorSetup);
  const disable = useAction(disableTwoFactor);
  const regenerate = useAction(regenerateBackupCodes);

  function closeAll() {
    setFlow(null);
    setSetup(null);
    setCode("");
    setCodeError(null);
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(totpCodeSchema, { code });
    if (!check.ok) return setCodeError(messages.field(check.errors.code));
    const result = await confirm.executeAsync(check.data);
    const status = result.data?.status;
    if (status === "enabled") {
      setCodeError(null);
      setFlow("enable-codes");
    } else if (status === "invalid_code") setCodeError(t("invalidCode"));
    else if (status === "locked") setCodeError(t("locked"));
    else setCodeError(messages.action(result.serverError));
  }

  return (
    <SettingsSection
      title={t("heading")}
      description={t("description")}
      aside={<Badge variant={enabled ? "default" : "secondary"}>{enabled ? t("statusOn") : t("statusOff")}</Badge>}
    >
      <div className="flex flex-wrap gap-2">
        {enabled ? (
          <>
            <Button variant="outline" onClick={() => setFlow("codes-password")}>
              {t("newBackupCodes")}
            </Button>
            <Button variant="destructive" onClick={() => setFlow("disable")}>
              {t("disable")}
            </Button>
          </>
        ) : (
          <Button onClick={() => setFlow("enable-password")}>{t("enable")}</Button>
        )}
      </div>

      {/* Turning on, step 1: confirm the password. */}
      <PasswordConfirmDialog
        open={flow === "enable-password"}
        onOpenChange={(open) => !open && closeAll()}
        title={t("heading")}
        description={t("passwordStep")}
        submitLabel={t("continue")}
        onConfirm={async (password) => {
          const result = await start.executeAsync({ password });
          const data = result.data;
          if (data && "qrSvg" in data) {
            setSetup(data);
            setFlow("enable-scan");
            return null;
          }
          return data?.status === "wrong_password" ? t("wrongPassword") : messages.action(result.serverError);
        }}
      />

      {/* Steps 2–3: scan and verify, then save backup codes. */}
      <Dialog open={flow === "enable-scan" || flow === "enable-codes"} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {flow === "enable-scan" && setup ? (
            <form noValidate onSubmit={onVerify} className="space-y-5">
              <DialogHeader>
                <DialogTitle>{t("scanTitle")}</DialogTitle>
                <DialogDescription>{t("scanBody")}</DialogDescription>
              </DialogHeader>
              <div
                role="img"
                aria-label={t("qrAlt")}
                className="mx-auto size-48 rounded-2xl bg-white p-2 [&>svg]:size-full"
                // Generated on the server from the authenticator URI; contains no user input.
                dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
              />
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t("manualLabel")}</p>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">
                    {setup.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={keyCopied ? tCommon("copied") : tCommon("copy")}
                    onClick={async () => {
                      await navigator.clipboard.writeText(setup.secret);
                      setKeyCopied(true);
                      setTimeout(() => setKeyCopied(false), 2000);
                    }}
                  >
                    {keyCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                  </Button>
                </div>
              </div>
              <TextField
                label={t("codeLabel")}
                name="code"
                error={codeError}
                renderInput={(props) => <CodeInput {...props} value={code} onValueChange={setCode} />}
              />
              <SubmitButton pending={confirm.isPending} pendingLabel={t("verifying")}>
                {t("verify")}
              </SubmitButton>
            </form>
          ) : null}
          {flow === "enable-codes" && setup ? (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle>{t("backupTitle")}</DialogTitle>
                <DialogDescription>{t("backupBody")}</DialogDescription>
              </DialogHeader>
              <BackupCodes codes={setup.backupCodes} />
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  closeAll();
                  toast.success(t("enabled"));
                }}
              >
                {t("done")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={flow === "disable"}
        onOpenChange={(open) => !open && closeAll()}
        title={t("disableTitle")}
        description={t("disableBody")}
        submitLabel={t("disable")}
        destructive
        onConfirm={async (password) => {
          const result = await disable.executeAsync({ password });
          if (result.data?.status === "ok") {
            closeAll();
            toast.success(t("disabled"));
            return null;
          }
          return result.data?.status === "wrong_password" ? t("wrongPassword") : messages.action(result.serverError);
        }}
      />

      <PasswordConfirmDialog
        open={flow === "codes-password"}
        onOpenChange={(open) => !open && closeAll()}
        title={t("codesTitle")}
        description={t("codesBody")}
        submitLabel={t("continue")}
        onConfirm={async (password) => {
          const result = await regenerate.executeAsync({ password });
          const data = result.data;
          if (data && "backupCodes" in data) {
            setCodes(data.backupCodes);
            setFlow("codes-show");
            return null;
          }
          return data?.status === "wrong_password" ? t("wrongPassword") : messages.action(result.serverError);
        }}
      />

      <Dialog open={flow === "codes-show"} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent>
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle>{t("backupTitle")}</DialogTitle>
              <DialogDescription>{t("backupBody")}</DialogDescription>
            </DialogHeader>
            <BackupCodes codes={codes} />
            <Button size="lg" className="w-full" onClick={closeAll}>
              {t("done")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
