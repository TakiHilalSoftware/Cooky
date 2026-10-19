import { ArchiveIcon, InboxIcon, MessagesSquareIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { PersonAvatar } from "@/components/social/person-avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ConversationListDto, MessagePreviewDto } from "@/server/features/messages/dto";

import { MarkDelivered } from "./mark-delivered";

/** The inbox (PRD §3.6): newest first, unread in bold with a dot, archived chats behind a toggle. */
export function ConversationList({ list }: { list: ConversationListDto }) {
  const t = useTranslations("messages");
  const format = useFormatter();
  const now = useNow();

  return (
    <div className="space-y-4">
      <MarkDelivered />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{list.showingArchived ? t("archivedHeading") : t("inboxHint")}</p>
        {list.showingArchived ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/messages">
              <InboxIcon aria-hidden="true" data-icon="inline-start" />
              {t("backToInbox")}
            </Link>
          </Button>
        ) : list.archivedCount > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/messages?archived=1">
              <ArchiveIcon aria-hidden="true" data-icon="inline-start" />
              {t("showArchived", { count: list.archivedCount })}
            </Link>
          </Button>
        ) : null}
      </div>

      {list.conversations.length === 0 ? (
        <EmptyState
          title={list.showingArchived ? t("noArchivedTitle") : t("emptyTitle")}
          description={list.showingArchived ? t("noArchivedBody") : t("emptyBody")}
          illustration={<MessagesSquareIcon aria-hidden="true" className="size-14 text-primary-strong" />}
          action={
            <Button asChild size="lg">
              <Link href={list.showingArchived ? "/messages" : "/friends"}>
                {list.showingArchived ? t("backToInbox") : t("goToFriends")}
              </Link>
            </Button>
          }
          className="rounded-3xl border border-dashed border-border py-12"
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {list.conversations.map((c) => (
            <li key={c.id} className="relative">
              <Link
                href={`/messages/${c.id}`}
                className="flex min-h-16 items-center gap-3 p-4 outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <PersonAvatar person={c.person} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate", c.unread ? "font-semibold" : "font-medium")}>
                      {c.person.displayName}
                    </span>
                    {c.last ? (
                      <time dateTime={c.last.at} className="shrink-0 text-xs text-muted-foreground">
                        {format.relativeTime(new Date(c.last.at), now)}
                      </time>
                    ) : null}
                  </div>
                  <p
                    dir="auto"
                    className={cn(
                      "truncate text-start text-sm",
                      c.unread ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Preview last={c.last} />
                  </p>
                </div>
                {c.unread ? (
                  <>
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-primary" />
                    <span className="sr-only">{t("unread")}</span>
                  </>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Preview({ last }: { last: MessagePreviewDto | null }) {
  const t = useTranslations("messages");
  if (!last) return null;
  const body = last.kind === "deleted" ? t("deletedPreview") : last.kind === "dish" ? t("dishPreview") : last.text;
  return last.fromMe ? t("youPrefix", { text: body ?? "" }) : body;
}
