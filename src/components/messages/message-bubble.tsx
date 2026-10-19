"use client";

import { CheckCheckIcon, CheckIcon, EllipsisIcon, FlagIcon, PencilIcon, Trash2Icon, UtensilsIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { toastUndo } from "@/components/feedback/toast-undo";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { ReportDialog } from "@/components/social/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { MESSAGE_MAX } from "@/lib/social";
import { cn } from "@/lib/utils";
import { deleteMessage, editMessage, restoreMessage } from "@/server/actions/messages";
import type { MessageDishDto, MessageDto } from "@/server/features/messages/dto";

type MessageBubbleProps = {
  message: MessageDto;
  /** The other person's name, for labels. */
  otherName: string;
  /** Edit/delete need a chat you can still write to. */
  canSend: boolean;
  /** Show "Sent / Delivered / Seen" under this one (your latest message). */
  showStatus: boolean;
};

export function MessageBubble({ message, otherName, canSend, showStatus }: MessageBubbleProps) {
  const t = useTranslations("messages");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const messages = useFormMessages();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text ?? "");
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const time = format.dateTime(new Date(message.at), { timeStyle: "short" });
  const mine = message.fromMe;

  async function onDelete() {
    const result = await deleteMessage({ messageId: message.id });
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toastUndo(t("deleted"), {
      undoLabel: tCommon("undo"),
      onUndo: async () => {
        const restored = await restoreMessage({ messageId: message.id });
        if (!restored?.data) toast.error(messages.action(restored?.serverError));
      },
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    if (content === message.text) return setEditing(false);
    setSaving(true);
    const result = await editMessage({ messageId: message.id, content });
    setSaving(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    setEditing(false);
  }

  const menuLabel = t("messageOptions", { time });
  const hasMenu = !message.deleted && (mine ? canSend : true);

  return (
    <li className={cn("group flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <div className={cn("flex max-w-[85%] items-end gap-1 sm:max-w-[70%]", mine && "flex-row-reverse")}>
        {editing ? (
          <form
            onSubmit={onSave}
            className="w-[min(32rem,80vw)] space-y-2 rounded-2xl border border-border bg-card p-2"
          >
            <label htmlFor={`edit-${message.id}`} className="sr-only">
              {t("editLabel")}
            </label>
            <Textarea
              id={`edit-${message.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MESSAGE_MAX}
              rows={3}
              dir="auto"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={saving || !draft.trim()}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {t("saveEdit")}
              </Button>
            </div>
          </form>
        ) : (
          <div
            className={cn(
              "min-w-0 space-y-2 rounded-3xl px-4 py-2.5",
              message.deleted
                ? "border border-dashed border-border bg-transparent text-muted-foreground italic"
                : mine
                  ? "rounded-ee-md bg-primary text-primary-foreground"
                  : "rounded-es-md bg-muted text-foreground",
            )}
          >
            {message.deleted ? (
              <p className="text-sm">{mine ? t("youDeleted") : t("theyDeleted", { name: otherName })}</p>
            ) : (
              <>
                {message.dish ? <DishCard dish={message.dish} mine={mine} /> : null}
                {message.text ? (
                  <p dir="auto" className="break-words whitespace-pre-wrap">
                    {message.text}
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
        {hasMenu && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={menuLabel}
                title={menuLabel}
                className="shrink-0 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:data-[state=open]:opacity-100"
              >
                <EllipsisIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              {mine ? (
                <>
                  {message.text !== null ? (
                    <DropdownMenuItem className="min-h-10" onSelect={() => setEditing(true)}>
                      <PencilIcon aria-hidden="true" />
                      {t("edit")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem className="min-h-10" onSelect={() => void onDelete()}>
                    <Trash2Icon aria-hidden="true" />
                    {t("delete")}
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem variant="destructive" className="min-h-10" onSelect={() => setReporting(true)}>
                  <FlagIcon aria-hidden="true" />
                  {t("reportMessage")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <p className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
        <time dateTime={message.at}>{time}</time>
        {message.edited ? <span>· {t("edited")}</span> : null}
        {showStatus && message.status ? <Status status={message.status} /> : null}
      </p>
      {!mine ? (
        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          targetType="message"
          targetId={message.id}
          subject={otherName}
        />
      ) : null}
    </li>
  );
}

function Status({ status }: { status: NonNullable<MessageDto["status"]> }) {
  const t = useTranslations("messages.status");
  const Icon = status === "sent" ? CheckIcon : CheckCheckIcon;
  return (
    <span className={cn("inline-flex items-center gap-0.5", status === "seen" && "text-primary-strong")}>
      · <Icon aria-hidden="true" className="size-3.5" />
      {t(status)}
    </span>
  );
}

function DishCard({ dish, mine }: { dish: MessageDishDto; mine: boolean }) {
  const t = useTranslations("messages");
  const tDishes = useTranslations("dishes");
  if (!dish.available) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-background/20 p-2 text-sm opacity-80">
        <UtensilsIcon aria-hidden="true" className="size-4 shrink-0" />
        {t("dishUnavailable")}
      </p>
    );
  }
  return (
    <Link
      href={`/dishes/${dish.id}`}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl p-2 text-start no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        mine ? "bg-primary-foreground/15 hover:bg-primary-foreground/25" : "bg-background hover:bg-background/70",
      )}
    >
      {dish.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dish.photoUrl} alt="" width={64} height={48} className="h-12 w-16 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <UtensilsIcon aria-hidden="true" className="size-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">{dish.name}</span>
        <span className="block text-xs opacity-80">
          {tDishes(`course.${dish.course}`)} · {t("openDish")}
        </span>
      </span>
    </Link>
  );
}
