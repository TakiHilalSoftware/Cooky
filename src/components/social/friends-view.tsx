"use client";

import { BanIcon, CheckIcon, PencilIcon, PlusIcon, Trash2Icon, UsersRoundIcon, XIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useUpgradeSheet } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { markFriendsSeen, respondToFriendRequest } from "@/server/actions/friends";
import { deleteFriendGroup } from "@/server/actions/sharing";
import type { FriendGroupDto, FriendRequestDto, FriendsPageDto } from "@/server/features/social/dto";

import { GroupDialog } from "./group-dialog";
import { PeopleSearch } from "./people-search";
import { PersonAvatar } from "./person-avatar";
import { PersonMenu } from "./person-menu";
import { RelationButton } from "./relation-button";

/** Friends (PRD §3.6): find people, answer requests, your friends, sent requests and groups. */
export function FriendsView({ page, hasNewRequests }: { page: FriendsPageDto; hasNewRequests: boolean }) {
  const t = useTranslations("friends");
  const format = useFormatter();
  const now = useNow();
  const searchRef = useRef<HTMLInputElement>(null);

  // Opening Friends clears the new-request badge (PRD §3.0).
  useEffect(() => {
    if (hasNewRequests) void markFriendsSeen({});
  }, [hasNewRequests]);

  return (
    <div className="space-y-10">
      <PeopleSearch inputRef={searchRef} />

      {page.incoming.length > 0 ? (
        <Section id="requests" title={t("requestsHeading")} count={page.incoming.length} hint={t("requestsHint")}>
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {page.incoming.map((request) => (
              <IncomingRow key={request.id} request={request} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t("friendsHeading")} count={page.friends.length}>
        {page.friends.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyBody")}
            illustration={<UsersRoundIcon aria-hidden="true" className="size-14 text-primary-strong" />}
            action={
              <Button
                size="lg"
                onClick={() => {
                  searchRef.current?.focus();
                  searchRef.current?.scrollIntoView({ block: "center" });
                }}
              >
                {t("findPeople")}
              </Button>
            }
            headingLevel={3}
            className="rounded-3xl border border-dashed border-border py-10"
          />
        ) : (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {page.friends.map((friend) => (
              <li key={friend.id} className="flex flex-wrap items-center gap-3 p-4">
                <PersonAvatar person={friend} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/friends/${friend.id}`}
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {friend.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t("friendsSince", { date: format.dateTime(new Date(friend.since), { dateStyle: "medium" }) })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <RelationButton person={friend} />
                  <PersonMenu person={friend} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {page.outgoing.length > 0 ? (
        <Section title={t("sentHeading")} count={page.outgoing.length} hint={t("sentHint")}>
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {page.outgoing.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 p-4">
                <PersonAvatar person={request.person} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/friends/${request.person.id}`}
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {request.person.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t("sentAgo", { time: format.relativeTime(new Date(request.sentAt), now) })}
                  </p>
                </div>
                <RelationButton person={request.person} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <GroupsSection page={page} />

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BanIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>
          {t.rich("blockedNote", {
            link: (chunks) => (
              <Link href="/settings/privacy" className="font-medium text-foreground underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </p>
    </div>
  );
}

function Section({
  id,
  title,
  count,
  hint,
  action,
  children,
}: {
  id?: string;
  title: string;
  count: number;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id={id ? `${id}-heading` : undefined} className="font-heading text-2xl">
            {title} <span className="text-base font-normal text-muted-foreground tabular-nums">({count})</span>
          </h2>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function IncomingRow({ request }: { request: FriendRequestDto }) {
  const t = useTranslations("friends");
  const format = useFormatter();
  const now = useNow();
  const messages = useFormMessages();
  const online = useOnline();
  const [pending, setPending] = useState<"accept" | "decline" | "block" | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const name = request.person.displayName;

  async function respond(response: "accept" | "decline" | "block") {
    if (!online) {
      toast.error(t("offline"));
      return false;
    }
    setPending(response);
    const result = await respondToFriendRequest({ requestId: request.id, response });
    setPending(null);
    if (!result?.data) {
      toast.error(messages.action(result?.serverError));
      return false;
    }
    toast.success(
      response === "accept"
        ? t("nowFriends", { name })
        : response === "decline"
          ? t("declined", { name })
          : t("blocked", { name }),
    );
    return true;
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <PersonAvatar person={request.person} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/friends/${request.person.id}`}
          className="block truncate font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {t("receivedAgo", { time: format.relativeTime(new Date(request.sentAt), now) })}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" disabled={pending !== null} onClick={() => void respond("accept")}>
          <CheckIcon aria-hidden="true" data-icon="inline-start" />
          {t("accept")}
        </Button>
        <IconButton
          label={t("declineLabel", { name })}
          disabled={pending !== null}
          onClick={() => void respond("decline")}
        >
          <XIcon aria-hidden="true" />
        </IconButton>
        <IconButton label={t("blockLabel", { name })} disabled={pending !== null} onClick={() => setConfirmBlock(true)}>
          <BanIcon aria-hidden="true" />
        </IconButton>
      </div>
      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={t("blockTitle", { name })}
        description={t("blockBody", { name })}
        confirmLabel={t("block")}
        onConfirm={() => respond("block")}
      />
    </li>
  );
}

function GroupsSection({ page }: { page: FriendsPageDto }) {
  const t = useTranslations("friends.groups");
  const openUpgrade = useUpgradeSheet();
  const [editing, setEditing] = useState<FriendGroupDto | "new" | null>(null);
  const { count, limit, canAdd } = page.groupAllowance;

  return (
    <Section
      title={t("heading")}
      count={page.groups.length}
      hint={t("hint")}
      action={
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            onClick={() =>
              canAdd ? setEditing("new") : openUpgrade({ feature: "friend_groups", reason: "quota_exceeded" })
            }
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            {t("new")}
          </Button>
          {limit !== null ? (
            <span className="text-xs text-muted-foreground tabular-nums">{t("allowance", { count, limit })}</span>
          ) : null}
        </div>
      }
    >
      {page.groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {page.groups.map((group) => (
            <GroupCard key={group.id} group={group} page={page} onEdit={() => setEditing(group)} />
          ))}
        </ul>
      )}
      {editing !== null ? (
        <GroupDialog
          // A fresh form per group, so switching between them never carries values over.
          key={editing === "new" ? "new" : editing.id}
          open
          onOpenChange={(open) => (open ? undefined : setEditing(null))}
          friends={page.friends}
          group={editing === "new" ? undefined : editing}
        />
      ) : null}
    </Section>
  );
}

function GroupCard({ group, page, onEdit }: { group: FriendGroupDto; page: FriendsPageDto; onEdit: () => void }) {
  const t = useTranslations("friends.groups");
  const messages = useFormMessages();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const members = page.friends.filter((f) => group.memberIds.includes(f.id));
  const names = members.map((m) => m.displayName).join(", ");

  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg">{group.name}</h3>
          <p className="text-sm text-muted-foreground">{t("members", { count: members.length })}</p>
        </div>
        <div className="flex shrink-0">
          <IconButton label={t("editLabel", { name: group.name })} onClick={onEdit}>
            <PencilIcon aria-hidden="true" />
          </IconButton>
          <IconButton label={t("deleteLabel", { name: group.name })} onClick={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {members.length > 0 ? (
        <div className="flex items-center gap-2" title={names}>
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {members.slice(0, 5).map((m) => (
              <PersonAvatar key={m.id} person={m} className="size-8 ring-2 ring-card" />
            ))}
          </div>
          <span className="sr-only">{names}</span>
          {members.length > 5 ? (
            <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
              +{members.length - 5}
            </span>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle", { name: group.name })}
        description={t("deleteBody")}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          const result = await deleteFriendGroup({ id: group.id });
          if (!result?.data) {
            toast.error(messages.action(result?.serverError));
            return false;
          }
          toast.success(t("deleted", { name: group.name }));
        }}
      />
    </li>
  );
}
