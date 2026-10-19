"use client";

import { BugIcon, LightbulbIcon, MessageCircleQuestionIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ChoiceGroup } from "@/components/forms/choice-group";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_MESSAGE_MAX, type FeedbackKind } from "@/lib/admin";
import { checkFields } from "@/lib/forms";
import { sendFeedback } from "@/server/actions/account";
import { sendFeedbackSchema } from "@/server/features/admin/schema";

import { SettingsSection } from "./settings-section";

const ICONS = { bug: BugIcon, feature: LightbulbIcon, other: MessageCircleQuestionIcon } as const;

/** Help & feedback (PRD §3.8): tell the team about a bug, an idea or anything else. */
export function FeedbackCard() {
  const t = useTranslations("helpFeedback");
  const messages = useFormMessages();
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(sendFeedbackSchema, { kind, message });
    if (!check.ok) return setError(messages.field(check.errors.message));
    setPending(true);
    const result = await sendFeedback(check.data);
    setPending(false);
    if (result?.data) {
      setMessage("");
      setError(null);
      return toast.success(t("sent"));
    }
    setError(result?.serverError === "rate_limited" ? t("tooMany") : messages.action(result?.serverError));
  }

  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <ChoiceGroup
          legend={t("kindLabel")}
          value={kind}
          onValueChange={setKind}
          className="grid-cols-3"
          choices={(["bug", "feature", "other"] as const).map((value) => {
            const Icon = ICONS[value];
            return { value, label: t(`kind.${value}`), visual: <Icon className="size-5" /> };
          })}
        />
        <div className="space-y-2">
          <Label htmlFor={id}>{t("messageLabel")}</Label>
          <Textarea
            id={id}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={FEEDBACK_MESSAGE_MAX}
            rows={5}
            dir="auto"
            placeholder={t(`placeholder.${kind}`)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          />
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {t("attached")}
          </p>
          {error ? (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SendIcon aria-hidden="true" data-icon="inline-start" className="rtl:-scale-x-100" />
          )}
          {t("send")}
        </Button>
      </form>
    </SettingsSection>
  );
}
