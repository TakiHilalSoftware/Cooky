"use client";

import { CheckIcon, EyeOffIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "@/i18n/navigation";
import {
  adminDeleteDish,
  adminDeleteFeedback,
  adminDeleteReview,
  adminMakeDishPrivate,
  adminResolveReport,
  adminSetFeedbackStatus,
} from "@/server/actions/admin";
import type { FeedbackDto, ReportDto, ReviewModerationDto, SharedDishModerationDto } from "@/server/features/admin/dto";

type Result = { data?: unknown; serverError?: unknown } | undefined;

function useRunner() {
  const messages = useFormMessages();
  return async (call: () => Promise<Result>, done: string) => {
    const result = await call();
    if (result?.data) {
      toast.success(done);
      return true;
    }
    toast.error(messages.action(result?.serverError));
    return false;
  };
}

/** A written review: delete it (removes the rating too). */
export function ReviewRow({ review }: { review: ReviewModerationDto }) {
  const t = useTranslations("admin.content");
  const format = useFormatter();
  const now = useNow();
  const run = useRunner();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {review.author} · {t("stars", { count: review.stars })}
        </p>
        <span className="text-xs text-muted-foreground">{format.relativeTime(new Date(review.at), now)}</span>
      </div>
      <p className="text-sm text-muted-foreground">{t("onDish", { name: review.dishName })}</p>
      <p dir="auto" className="text-sm break-words whitespace-pre-line">
        {review.review}
      </p>
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <Trash2Icon aria-hidden="true" data-icon="inline-start" />
        {t("deleteReview")}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("deleteReviewTitle")}
        description={t("deleteReviewBody", { name: review.author })}
        confirmLabel={t("deleteReview")}
        onConfirm={() => run(() => adminDeleteReview({ id: review.id }), t("reviewDeleted"))}
      />
    </li>
  );
}

/** A shared dish: make it private (owner keeps it) or delete it. */
export function SharedDishRow({ dish }: { dish: SharedDishModerationDto }) {
  const t = useTranslations("admin.content");
  const format = useFormatter();
  const now = useNow();
  const run = useRunner();
  const [confirm, setConfirm] = useState<"private" | "delete" | null>(null);
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium break-words">{dish.name}</p>
        <span className="text-xs text-muted-foreground">{format.relativeTime(new Date(dish.at), now)}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        <Link href={`/admin/users/${dish.ownerId}`} className="underline underline-offset-4">
          {dish.owner}
        </Link>{" "}
        · {t(`visibility.${dish.visibility}`)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirm("private")}>
          <EyeOffIcon aria-hidden="true" data-icon="inline-start" />
          {t("makePrivate")}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setConfirm("delete")}>
          <Trash2Icon aria-hidden="true" data-icon="inline-start" />
          {t("deleteDish")}
        </Button>
      </div>
      {confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setConfirm(null))}
          title={
            confirm === "private"
              ? t("makePrivateTitle", { name: dish.name })
              : t("deleteDishTitle", { name: dish.name })
          }
          description={confirm === "private" ? t("makePrivateBody") : t("deleteDishBody", { name: dish.owner })}
          confirmLabel={confirm === "private" ? t("makePrivate") : t("deleteDish")}
          destructive={confirm === "delete"}
          onConfirm={() =>
            confirm === "private"
              ? run(() => adminMakeDishPrivate({ id: dish.id }), t("madePrivate"))
              : run(() => adminDeleteDish({ id: dish.id }), t("dishDeleted"))
          }
        />
      ) : null}
    </li>
  );
}

/** One report, with what was reported and the resolve dialog. */
export function ReportRow({ report }: { report: ReportDto }) {
  const t = useTranslations("admin.reports");
  const tReason = useTranslations("report.reason");
  const format = useFormatter();
  const now = useNow();
  const run = useRunner();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"resolved" | "dismissed">("resolved");
  const [action, setAction] = useState<"none" | "remove_content" | "suspend_user">("none");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const canRemove = report.targetType !== "user" && report.preview !== null;

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{t(`target.${report.targetType}`)}</Badge>
        <Badge variant="outline">{tReason(report.reason)}</Badge>
        <span className="text-xs text-muted-foreground">
          {t("by", {
            name: report.reporter ?? t("deletedAccount"),
            time: format.relativeTime(new Date(report.at), now),
          })}
        </span>
      </div>
      <div className="rounded-2xl bg-muted p-3 text-sm">
        {report.preview ? (
          <>
            {report.preview.title ? <p className="font-medium break-words">{report.preview.title}</p> : null}
            {report.preview.text ? (
              <p dir="auto" className="break-words whitespace-pre-line">
                {report.preview.text}
              </p>
            ) : null}
            {report.preview.ownerId ? (
              <Link href={`/admin/users/${report.preview.ownerId}`} className="text-xs underline underline-offset-4">
                {t("openOwner")}
              </Link>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">{t("gone")}</p>
        )}
      </div>
      {report.details ? (
        <p dir="auto" className="text-sm break-words">
          <span className="text-muted-foreground">{t("details")} </span>
          {report.details}
        </p>
      ) : null}
      {report.status === "open" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <CheckIcon aria-hidden="true" data-icon="inline-start" />
          {t("handle")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(`closed.${report.status}`)}
          {report.resolution ? ` · ${report.resolution}` : ""}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t("handleTitle")}</DialogTitle>
            <DialogDescription>{t("handleBody")}</DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{t("outcome")}</legend>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v === "dismissed" ? "dismissed" : "resolved")}>
              {(["resolved", "dismissed"] as const).map((s) => (
                <Label
                  key={s}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 font-normal"
                >
                  <RadioGroupItem value={s} />
                  {t(`outcomes.${s}`)}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          {status === "resolved" ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{t("alsoDo")}</legend>
              <RadioGroup
                value={action}
                onValueChange={(v) =>
                  setAction(v === "remove_content" ? "remove_content" : v === "suspend_user" ? "suspend_user" : "none")
                }
              >
                {(["none", "remove_content", "suspend_user"] as const)
                  .filter((a) => a !== "remove_content" || canRemove)
                  .map((a) => (
                    <Label
                      key={a}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 font-normal"
                    >
                      <RadioGroupItem value={a} />
                      {t(`actions.${a}`)}
                    </Label>
                  ))}
              </RadioGroup>
            </fieldset>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`note-${report.id}`}>{t("note")}</Label>
            <Textarea
              id={`note-${report.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={pending}
              variant={action === "none" ? "default" : "destructive"}
              onClick={async () => {
                setPending(true);
                const ok = await run(
                  () =>
                    adminResolveReport({
                      id: report.id,
                      status,
                      action: status === "resolved" ? action : "none",
                      resolution: note.trim() || undefined,
                    }),
                  t("handled"),
                );
                setPending(false);
                if (ok) setOpen(false);
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** A feedback message: resolve, reopen or delete. */
export function FeedbackRow({ item }: { item: FeedbackDto }) {
  const t = useTranslations("admin.feedback");
  const tKind = useTranslations("helpFeedback.kind");
  const format = useFormatter();
  const now = useNow();
  const run = useRunner();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{tKind(item.kind)}</Badge>
        <Badge variant={item.status === "open" ? "default" : "outline"}>{t(`status.${item.status}`)}</Badge>
        <span className="text-xs text-muted-foreground">{format.relativeTime(new Date(item.at), now)}</span>
      </div>
      <p dir="auto" className="text-sm break-words whitespace-pre-line">
        {item.message}
      </p>
      <p className="text-xs text-muted-foreground">
        {item.author ?? t("deletedAccount")}
        {item.email ? (
          <>
            {" · "}
            <bdi dir="ltr">{item.email}</bdi>
          </>
        ) : null}
        {" · "}
        {item.locale.toUpperCase()}
        {item.userAgent ? ` · ${item.userAgent}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {item.status === "open" ? (
          <Button
            size="sm"
            onClick={() => void run(() => adminSetFeedbackStatus({ id: item.id, status: "resolved" }), t("resolved"))}
          >
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
            {t("resolve")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(() => adminSetFeedbackStatus({ id: item.id, status: "open" }), t("reopened"))}
          >
            <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
            {t("reopen")}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
          <Trash2Icon aria-hidden="true" data-icon="inline-start" />
          {t("delete")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("delete")}
        onConfirm={() => run(() => adminDeleteFeedback({ id: item.id }), t("deleted"))}
      />
    </li>
  );
}
