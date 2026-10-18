"use client";

import { startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { CloudIcon, KeyRoundIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { checkFields } from "@/lib/forms";
import { deletePasskey, passkeyRegistrationOptions, registerPasskey, renamePasskey } from "@/server/actions/security";
import type { PasskeyDto } from "@/server/features/security/dto";
import { passkeyNameSchema } from "@/server/features/security/schema";

import { useWebAuthnSupport } from "./use-webauthn-support";

export function PasskeysCard({ passkeys }: { passkeys: PasskeyDto[] }) {
  const t = useTranslations("settings.security.passkeys");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const messages = useFormMessages();
  const supported = useWebAuthnSupport();
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<PasskeyDto | null>(null);
  const [removing, setRemoving] = useState<PasskeyDto | null>(null);

  const options = useAction(passkeyRegistrationOptions);
  const register = useAction(registerPasskey);
  const remove = useAction(deletePasskey);

  async function add() {
    setProblem(null);
    setAdding(true);
    try {
      const prepared = await options.executeAsync();
      if (!prepared.data) return setProblem(messages.action(prepared.serverError));
      let response;
      try {
        response = await startRegistration({ optionsJSON: prepared.data });
      } catch (error) {
        // The person closed the prompt, or the device refused: say which.
        const cancelled =
          error instanceof WebAuthnError
            ? error.code === "ERROR_CEREMONY_ABORTED"
            : error instanceof DOMException && error.name === "NotAllowedError";
        return setProblem(cancelled ? t("cancelled") : t("failed"));
      }
      const saved = await register.executeAsync({ response });
      if (saved.serverError) return setProblem(t("failed"));
      toast.success(t("added"));
    } finally {
      setAdding(false);
    }
  }

  const name = (passkey: PasskeyDto) => passkey.name ?? t("unnamed");

  return (
    <SettingsSection
      title={t("heading")}
      description={t("description")}
      aside={
        <Button onClick={add} disabled={!supported || adding} title={supported ? undefined : t("unsupported")}>
          {adding ? <Spinner data-icon="inline-start" /> : <PlusIcon aria-hidden="true" data-icon="inline-start" />}
          {adding ? t("adding") : t("add")}
        </Button>
      }
    >
      <div className="space-y-3">
        {!supported ? <p className="text-sm text-muted-foreground">{t("unsupported")}</p> : null}
        {problem ? <FormAlert tone="error">{problem}</FormAlert> : null}
        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center gap-3 p-3 sm:p-4">
                <KeyRoundIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{name(passkey)}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    {passkey.synced ? (
                      <span className="inline-flex items-center gap-1">
                        <CloudIcon aria-hidden="true" className="size-3.5" />
                        {t("synced")}
                      </span>
                    ) : (
                      <span>{t("singleDevice")}</span>
                    )}
                    {passkey.createdAt ? (
                      <span>
                        {t("addedOn", { date: format.dateTime(new Date(passkey.createdAt), { dateStyle: "medium" }) })}
                      </span>
                    ) : null}
                  </p>
                </div>
                <IconButton label={`${t("rename")}: ${name(passkey)}`} onClick={() => setRenaming(passkey)}>
                  <PencilIcon aria-hidden="true" />
                </IconButton>
                <IconButton label={`${t("remove")}: ${name(passkey)}`} onClick={() => setRemoving(passkey)}>
                  <Trash2Icon aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RenamePasskeyDialog passkey={renaming} onClose={() => setRenaming(null)} />

      {/* Removing a passkey can't be undone, so it's confirmed (PRD §3.10). */}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {removing ? t("removeBody", { name: name(removing) }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!removing) return;
                const result = await remove.executeAsync({ id: removing.id });
                if (result.serverError) toast.error(messages.action(result.serverError));
                else toast.success(t("removed"));
                setRemoving(null);
              }}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}

function RenamePasskeyDialog({ passkey, onClose }: { passkey: PasskeyDto | null; onClose: () => void }) {
  const t = useTranslations("settings.security.passkeys");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rename = useAction(renamePasskey);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passkey) return;
    const check = checkFields(passkeyNameSchema, { id: passkey.id, name });
    if (!check.ok) return setError(messages.field(check.errors.name));
    const result = await rename.executeAsync(check.data);
    if (result.serverError) return setError(messages.action(result.serverError));
    toast.success(t("renamed"));
    onClose();
  }

  return (
    <Dialog
      open={passkey !== null}
      onOpenChange={(open) => {
        if (open) return;
        setError(null);
        onClose();
      }}
    >
      <DialogContent onOpenAutoFocus={() => setName(passkey?.name ?? "")}>
        <form noValidate onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </DialogHeader>
          <TextField
            label={t("nameLabel")}
            name="name"
            autoFocus
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <SubmitButton pending={rename.isPending} pendingLabel={t("saving")} className="w-full sm:w-auto">
              {t("save")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
