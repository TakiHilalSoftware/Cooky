"use client";

import { HistoryIcon, MicIcon, PlusIcon, SendHorizontalIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { CookyIcon } from "@/components/brand/cooky-icon";
import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { TriesMeter } from "@/components/paywall/tries-meter";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAudioRecorder, type RecorderProblem } from "@/components/voice/use-audio-recorder";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { askAssistant, deleteAssistantThread, transcribeQuestion } from "@/server/actions/assistant";
import type { AssistantMessageDto, AssistantPageDto, AssistantThreadDto } from "@/server/features/assistant/dto";
import { ASSISTANT_MESSAGE_MAX } from "@/server/features/assistant/schema";

import { PickCard } from "./pick-card";

const QUICK_STARTS = ["withChicken", "quickTonight", "lightDinner", "nextEvent"] as const;

/**
 * The AI Assistant (PRD §3.4): a conversation that suggests real dishes. "New
 * chat" and the disclaimer are always in view; history is saved and deletable.
 */
export function AssistantView({ page }: { page: AssistantPageDto }) {
  const t = useTranslations("assistant");
  const tVoice = useTranslations("dishes.voice");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const online = useOnline();
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const threadId = page.thread?.id ?? null;
  const [shown, setShown] = useState<AssistantMessageDto[]>(page.thread?.messages ?? []);
  const [seen, setSeen] = useState(page.thread);
  if (seen !== page.thread) {
    setSeen(page.thread);
    setShown(page.thread?.messages ?? []);
  }
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceProblem, setVoiceProblem] = useState<RecorderProblem | null>(null);
  const pendingSeq = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // A block body: browsers now return a Promise from scrollIntoView, and an effect may only return a cleanup.
    bottom.current?.scrollIntoView({ block: "end" });
  }, [shown.length, sending]);

  const recorder = useAudioRecorder(async (audio) => {
    setTranscribing(true);
    const form = new FormData();
    form.append("audio", audio);
    form.append("locale", locale);
    const result = await transcribeQuestion(form);
    setTranscribing(false);
    if (result?.data) {
      setText((current) => `${current ? `${current} ` : ""}${result.data!.text}`.slice(0, ASSISTANT_MESSAGE_MAX));
      input.current?.focus();
      return;
    }
    const code = result?.serverError;
    if (code === "quota_exceeded" || code === "plan_required") return onActionError(code, "voice");
    setVoiceProblem(code === "not_found" ? "nothingHeard" : "unavailable");
  });
  const voiceError = recorder.state.kind === "error" ? recorder.state.problem : voiceProblem;

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;
    if (!online) return setProblem(t("offline"));
    setProblem(null);
    setSending(true);
    const pendingId = `pending-${++pendingSeq.current}`;
    setShown((list) => [...list, { id: pendingId, role: "user", content: trimmed, picks: [] }]);
    setText("");
    const result = await askAssistant({ threadId, text: trimmed, locale });
    setSending(false);
    if (result?.data) {
      const { data } = result;
      setShown((list) => [...list.filter((m) => m.id !== pendingId), data.question, data.answer]);
      if (!threadId) router.replace(`/assistant/${data.threadId}`, { scroll: false });
      else router.refresh();
      return;
    }
    // Nothing was saved: take the question back into the box so it isn't lost.
    setShown((list) => list.filter((m) => m.id !== pendingId));
    setText(trimmed);
    const code = result?.serverError;
    if (code === "quota_exceeded" || code === "plan_required") return onActionError(code, "assistant");
    setProblem(code === "unavailable" ? t("unavailable") : messages.action(code));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter is a new line (the usual chat convention).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(text);
    }
  }

  const threadsList = <ThreadList threads={page.threads} current={threadId} />;
  const disabled = !page.available || sending;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden space-y-3 lg:block">{threadsList}</aside>

      <section
        aria-labelledby="assistant-heading"
        className="flex min-h-[70dvh] flex-col rounded-3xl border border-border bg-card"
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <h1 id="assistant-heading" className="min-w-0 flex-1 truncate font-heading text-2xl">
            {page.thread?.title ?? t("title")}
          </h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <HistoryIcon aria-hidden="true" data-icon="inline-start" />
                {t("history")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-4">
              <SheetHeader className="px-0">
                <SheetTitle>{t("history")}</SheetTitle>
              </SheetHeader>
              {threadsList}
            </SheetContent>
          </Sheet>
          <Button asChild variant="outline" size="sm">
            <Link href="/assistant">
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              {t("newChat")}
            </Link>
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4" aria-live="polite">
          {shown.length === 0 ? (
            <div className="mx-auto max-w-xl space-y-5 py-6 text-center">
              <CookyIcon className="mx-auto size-14" />
              <p className="text-pretty text-muted-foreground">{t("intro")}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {QUICK_STARTS.map((key) => (
                  <li key={key}>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      className="h-auto min-h-12 w-full justify-start text-start whitespace-normal"
                      onClick={() => send(t(`quick.${key}`))}
                    >
                      {t(`quick.${key}`)}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            shown.map((message) => <Message key={message.id} message={message} />)
          )}
          {sending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              {t("thinking")}
            </p>
          ) : null}
          <div ref={bottom} />
        </div>

        <form onSubmit={onSubmit} className="space-y-2 border-t border-border p-4">
          {!page.available ? <p className="rounded-xl bg-muted p-3 text-sm">{t("notSetUp")}</p> : null}
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          {voiceError ? <p className="text-sm text-destructive">{tVoice(`errors.${voiceError}`)}</p> : null}
          <label htmlFor="assistant-input" className="sr-only">
            {t("inputLabel")}
          </label>
          <Textarea
            ref={input}
            id="assistant-input"
            value={text}
            maxLength={ASSISTANT_MESSAGE_MAX}
            rows={2}
            placeholder={recorder.state.kind === "recording" ? tVoice("listening") : t("placeholder")}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            className="resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            {page.usage ? <TriesMeter usage={page.usage} variant="compact" /> : null}
            <span className="ms-auto text-xs text-muted-foreground tabular-nums">
              {text.length}/{ASSISTANT_MESSAGE_MAX}
            </span>
            {recorder.state.kind === "recording" ? (
              <Button type="button" variant="destructive" onClick={recorder.stop}>
                <SquareIcon aria-hidden="true" data-icon="inline-start" />
                <span className="tabular-nums">0:{String(recorder.state.seconds).padStart(2, "0")}</span>
              </Button>
            ) : (
              <IconButton
                label={t("speak")}
                variant="outline"
                disabled={disabled || transcribing}
                onClick={() => {
                  setVoiceProblem(null);
                  void recorder.start();
                }}
              >
                {transcribing ? <Spinner /> : <MicIcon aria-hidden="true" />}
              </IconButton>
            )}
            <Button type="submit" disabled={disabled || !text.trim()}>
              <SendHorizontalIcon aria-hidden="true" data-icon="inline-start" className="rtl:-scale-x-100" />
              {t("send")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
        </form>
      </section>
    </div>
  );
}

function Message({ message }: { message: AssistantMessageDto }) {
  const mine = message.role === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[min(36rem,92%)] space-y-3", mine && "text-end")}>
        <p
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-start text-pretty whitespace-pre-line",
            mine ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          {message.content}
        </p>
        {message.picks.length > 0 ? (
          <ul className="space-y-2">
            {message.picks.map((pick) => (
              <PickCard key={pick.kind === "mine" ? pick.dishId : pick.slug} pick={pick} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ThreadList({ threads, current }: { threads: AssistantThreadDto[]; current: string | null }) {
  const t = useTranslations("assistant");
  const messages = useFormMessages();
  const router = useRouter();
  const [deleting, setDeleting] = useState<AssistantThreadDto | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    const result = await deleteAssistantThread({ id: deleting.id });
    setDeleting(null);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(t("deleted"));
    if (deleting.id === current) router.replace("/assistant");
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("history")}</p>
      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
      ) : (
        <ul className="space-y-1">
          {threads.map((thread) => (
            <li key={thread.id} className="group flex items-center gap-1">
              <Link
                href={`/assistant/${thread.id}`}
                aria-current={thread.id === current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 items-center rounded-xl px-3 text-sm",
                  thread.id === current
                    ? "bg-secondary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="truncate">{thread.title}</span>
              </Link>
              <IconButton
                label={t("delete", { title: thread.title })}
                size="icon-sm"
                onClick={() => setDeleting(thread)}
              >
                <Trash2Icon aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody", { title: deleting?.title ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
