"use client";

import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { checkFields } from "@/lib/forms";
import { initialsOf } from "@/lib/initials";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { removeAvatar, uploadAvatar } from "@/server/actions/photos";
import { updateDisplayName } from "@/server/actions/settings";
import type { ProfileSettingsDto } from "@/server/features/profile/dto";
import { displayNameSchema } from "@/server/features/profile/schema";

import { SettingsSection } from "./settings-section";

export function ProfileCard({ profile }: { profile: ProfileSettingsDto }) {
  const t = useTranslations("settings.profile");
  const messages = useFormMessages();
  const emailId = useId();
  const [name, setName] = useState(profile.displayName);
  const [error, setError] = useState<string | null>(null);
  const save = useAction(updateDisplayName, {
    onSuccess: () => toast.success(t("saved")),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(displayNameSchema, { displayName: name });
    if (!check.ok) return setError(messages.field(check.errors.displayName));
    setError(null);
    save.execute(check.data);
  }

  const unchanged = name.trim() === profile.displayName;

  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="shrink-0 sm:w-52">
          <PhotoPicker
            photo={profile.avatar.photo}
            enabled={profile.avatar.enabled}
            shape="round"
            alt={t("photoAlt")}
            upload={(file) => {
              const form = new FormData();
              form.append("photo", file);
              return uploadAvatar(form);
            }}
            remove={() => removeAvatar({})}
            fallback={
              // Live preview: the initials update as the name is typed.
              <span
                aria-hidden="true"
                className="grid size-full place-items-center bg-primary font-heading text-2xl text-primary-foreground"
              >
                {initialsOf(name || profile.displayName)}
              </span>
            }
          />
        </div>
        <form noValidate onSubmit={onSubmit} className="w-full max-w-md space-y-5">
          {save.result.serverError ? (
            <FormAlert tone="error">{messages.action(save.result.serverError)}</FormAlert>
          ) : null}
          <TextField
            label={t("nameLabel")}
            hint={t("nameHint")}
            name="displayName"
            autoComplete="nickname"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error}
          />
          <div className="space-y-1">
            <p id={emailId} className="text-sm font-medium">
              {t("emailLabel")}
            </p>
            {/* <bdi>: the address reads left to right, the line follows the page direction. */}
            <p aria-labelledby={emailId} className="text-muted-foreground">
              <bdi dir="ltr">{profile.email}</bdi>
            </p>
            <p className="text-sm text-muted-foreground">{t("emailHint")}</p>
          </div>
          <SubmitButton
            pending={save.isPending}
            pendingLabel={t("saving")}
            disabled={unchanged}
            className="w-full sm:w-auto"
          >
            {t("save")}
          </SubmitButton>
        </form>
      </div>
    </SettingsSection>
  );
}
