"use client";

import { PaperclipIcon, SendHorizontalIcon, UtensilsIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_MAX } from "@/lib/social";
import { sendMessage, sendTyping } from "@/server/actions/messages";
import type { AttachableDishDto } from "@/server/features/messages/dto";

import { AttachDishDialog } from "./attach-dish-dialog";

/** Typing pings at most this often while someone types. */
const TYPING_EVERY_MS = 4000;

type ComposerProps = {
  conversationId: string;
  otherName: string;
  /** Realtime is on: only then is "typing…" worth sending. */
  live: boolean;
  /** Shown at once while the server saves it. */
  onSending: (text: string, dish: AttachableDishDto | null) => void;
  onSettled: () => void;
};

/** Write a message: Enter sends, Shift+Enter adds a line, and a dish can ride along as a card. */
export function Composer({ conversationId, otherName, live, onSending, onSettled }: ComposerProps) {
  const t = useTranslations("messages");
  const messages = useFormMessages();
  const online = useOnline();
  const id = useId();
  const [text, setText] = useState("");
  const [dish, setDish] = useState<AttachableDishDto | null>(null);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const lastTyping = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const empty = !text.trim() && !dish;

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (empty || sending) return;
    if (!online) return toast.error(t("offline"));
    const content = text.trim();
    const attached = dish;
    setSending(true);
    onSending(content, attached);
    setText("");
    setDish(null);
    const result = await sendMessage({ conversationId, content, dishId: attached?.id });
    setSending(false);
    onSettled();
    if (result?.data) return inputRef.current?.focus();
    // Give the words back so nothing typed is lost.
    setText(content);
    setDish(attached);
    toast.error(
      result?.serverError === "forbidden" ? t("readOnly", { name: otherName }) : messages.action(result?.serverError),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter (or composing with an IME) makes a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  function onChange(value: string) {
    setText(value);
    const now = Date.now();
    if (live && value.trim() && now - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = now;
      void sendTyping({ conversationId });
    }
  }

  return (
    <form onSubmit={send} className="space-y-2 border-t border-border bg-background p-2 sm:p-3">
      {dish ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
          <UtensilsIcon aria-hidden="true" className="size-4 shrink-0 text-primary-strong" />
          <span className="min-w-0 flex-1 truncate text-sm">{t("attached", { name: dish.name })}</span>
          <IconButton label={t("removeAttachment", { name: dish.name })} size="icon-sm" onClick={() => setDish(null)}>
            <XIcon aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}
      <div className="flex items-end gap-1">
        <IconButton label={t("attachDish")} onClick={() => setPicking(true)}>
          <PaperclipIcon aria-hidden="true" />
        </IconButton>
        <label htmlFor={id} className="sr-only">
          {t("messageLabel", { name: otherName })}
        </label>
        <Textarea
          ref={inputRef}
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX}
          rows={1}
          dir="auto"
          placeholder={t("placeholder", { name: otherName })}
          aria-describedby={`${id}-hint`}
          className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none"
        />
        <IconButton label={t("send")} type="submit" variant="default" disabled={empty || sending}>
          <SendHorizontalIcon aria-hidden="true" className="rtl:-scale-x-100" />
        </IconButton>
      </div>
      <p id={`${id}-hint`} className="hidden px-12 text-xs text-muted-foreground sm:block">
        {text.length > MESSAGE_MAX - 200 ? t("charsLeft", { count: MESSAGE_MAX - text.length }) : t("enterHint")}
      </p>
      <AttachDishDialog
        open={picking}
        onOpenChange={setPicking}
        conversationId={conversationId}
        otherName={otherName}
        onPick={(picked) => {
          setDish(picked);
          inputRef.current?.focus();
        }}
      />
    </form>
  );
}
