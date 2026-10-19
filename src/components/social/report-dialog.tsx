"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/social";
import { reportContent } from "@/server/actions/reports";

type ReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTarget;
  targetId: string;
  /** Shown in the title, e.g. the person's name or the dish name. */
  subject: string;
};

/** Report a person, dish, review or message (PRD §3.6). The person reported is never told who did it. */
export function ReportDialog({ open, onOpenChange, targetType, targetId, subject }: ReportDialogProps) {
  const t = useTranslations("report");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const detailsId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) {
      setReason(null);
      setDetails("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return setError(t("pickReason"));
    setPending(true);
    const result = await reportContent({ targetType, targetId, reason, details: details.trim() || undefined });
    setPending(false);
    if (result?.data) {
      toast.success(t("sent"));
      return close(false);
    }
    setError(messages.action(result?.serverError));
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t(`title.${targetType}`, { subject })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">{t("reasonLabel")}</legend>
            <RadioGroup
              value={reason ?? ""}
              onValueChange={(value) => {
                const picked = REPORT_REASONS.find((r) => r === value);
                if (picked) setReason(picked);
                setError(null);
              }}
              aria-invalid={error && !reason ? true : undefined}
            >
              {REPORT_REASONS.map((r) => (
                <Label
                  key={r}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 font-normal"
                >
                  <RadioGroupItem value={r} />
                  {t(`reason.${r}`)}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={detailsId}>{t("detailsLabel")}</Label>
            <Textarea
              id={detailsId}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={REPORT_DETAILS_MAX}
              rows={3}
              placeholder={t("detailsPlaceholder")}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
