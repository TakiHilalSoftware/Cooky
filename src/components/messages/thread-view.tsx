"use client";

import { LockIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useRealtime } from "@/components/app-shell/realtime-provider";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { markConversationRead } from "@/server/actions/messages";
import type { AttachableDishDto, ThreadDto } from "@/server/features/messages/dto";

import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";
import { ThreadHeader } from "./thread-header";

/** Without realtime (no Pusher keys), an open chat checks for news this often. */
const POLL_MS = 8000;
const TYPING_SHOWN_MS = 5000;
const MESSAGE_STEP = 50;

type Pending = { key: number; text: string; dish: AttachableDishDto | null };

/**
 * One conversation (PRD §3.6): newest at the bottom, 50 more on request,
 * typing and sent/delivered/seen, edits and deletes with Undo. Realtime
 * events carry ids only; the thread refreshes through the server.
 */
export function ThreadView({ thread }: { thread: ThreadDto }) {
  const t = useTranslations("messages");
  const format = useFormatter();
  const router = useRouter();
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = thread.messages.at(-1);
  const lastMineId = thread.messages.findLast((m) => m.fromMe && !m.deleted)?.id;

  const { live } = useRealtime((event) => {
    if (event.type === "friends" || event.conversationId !== thread.id) return;
    if (event.type === "typing") {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), TYPING_SHOWN_MS);
      return;
    }
    if (event.type === "message") setTyping(false);
    router.refresh();
  });

  // No realtime: check for news while the chat is on screen.
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, router]);

  // Reading the chat marks it read ("seen" for them, the unread dot clears).
  const latestId = latest?.id;
  const latestFromThem = latest ? !latest.fromMe : false;
  useEffect(() => {
    if (latestFromThem && document.visibilityState === "visible")
      void markConversationRead({ conversationId: thread.id });
  }, [latestId, latestFromThem, thread.id]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [latestId, pending.length]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // A day label before the first message of each day.
  const days = thread.messages.map((m) => format.dateTime(new Date(m.at), { dateStyle: "medium" }));

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem-5rem)] w-full max-w-3xl flex-col lg:h-[calc(100dvh-4rem)] lg:py-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card lg:rounded-3xl lg:border">
        <ThreadHeader thread={thread} typing={typing} />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
          {thread.hasEarlier ? (
            <div className="mb-4 flex justify-center">
              <Button asChild variant="outline" size="sm">
                <Link href={`/messages/${thread.id}?limit=${thread.limit + MESSAGE_STEP}`} scroll={false}>
                  {t("loadEarlier")}
                </Link>
              </Button>
            </div>
          ) : null}
          {thread.messages.length === 0 && pending.length === 0 ? (
            <p className="mx-auto mt-10 max-w-sm text-center text-sm text-muted-foreground">
              {thread.canSend ? t("startHint", { name: thread.person.displayName }) : t("nothingHere")}
            </p>
          ) : null}
          <ol className="space-y-3">
            {thread.messages.map((message, i) => {
              const day = days[i] ?? "";
              return (
                <DayGroup key={message.id} day={i === 0 || day !== days[i - 1] ? day : null}>
                  <MessageBubble
                    message={message}
                    otherName={thread.person.displayName}
                    canSend={thread.canSend}
                    showStatus={message.id === lastMineId}
                  />
                </DayGroup>
              );
            })}
            {pending.map((p) => (
              <li key={p.key} className="flex flex-col items-end gap-1 opacity-70">
                <div className="max-w-[85%] rounded-3xl rounded-ee-md bg-primary px-4 py-2.5 text-primary-foreground sm:max-w-[70%]">
                  {p.dish ? <p className="text-sm font-medium">{t("attached", { name: p.dish.name })}</p> : null}
                  {p.text ? (
                    <p dir="auto" className="break-words whitespace-pre-wrap">
                      {p.text}
                    </p>
                  ) : null}
                </div>
                <p className="px-2 text-xs text-muted-foreground">{t("sending")}</p>
              </li>
            ))}
          </ol>
          {typing ? (
            <p className="mt-3 text-sm text-muted-foreground italic">
              {t("typing", { name: thread.person.displayName })}
            </p>
          ) : null}
          <div ref={endRef} />
        </div>
        {thread.canSend ? (
          <Composer
            conversationId={thread.id}
            otherName={thread.person.displayName}
            live={live}
            onSending={(text, dish) => setPending((list) => [...list, { key: Date.now(), text, dish }])}
            onSettled={() => setPending((list) => list.slice(1))}
          />
        ) : (
          <div className="flex items-start gap-2 border-t border-border bg-muted p-4 text-sm text-muted-foreground">
            <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              {t.rich("readOnlyNotice", {
                name: thread.person.displayName,
                link: (chunks) => (
                  <Link
                    href={`/friends/${thread.person.id}`}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DayGroup({ day, children }: { day: string | null; children: React.ReactNode }) {
  if (!day) return children;
  return (
    <>
      <li className="py-2">
        <div role="separator" aria-label={day} className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <span aria-hidden="true">{day}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
      </li>
      {children}
    </>
  );
}
