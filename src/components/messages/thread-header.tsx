"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronLeftIcon,
  EllipsisVerticalIcon,
  FlagIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { PersonAvatar } from "@/components/social/person-avatar";
import { ReportDialog } from "@/components/social/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useRouter } from "@/i18n/navigation";
import { clearConversation, setConversationArchived } from "@/server/actions/messages";
import type { ThreadDto } from "@/server/features/messages/dto";

/** The friend's name (tap → profile popup), and archive / delete / report for this chat. */
export function ThreadHeader({ thread, typing }: { thread: ThreadDto; typing: boolean }) {
  const t = useTranslations("messages");
  const messages = useFormMessages();
  const router = useRouter();
  const [dialog, setDialog] = useState<"clear" | "report" | null>(null);
  const { person } = thread;
  const menuLabel = t("chatOptions");

  async function archive(archived: boolean) {
    const result = await setConversationArchived({ conversationId: thread.id, archived });
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(archived ? t("archived") : t("unarchived"));
    if (archived) router.push("/messages");
  }

  return (
    <header className="flex items-center gap-2 border-b border-border px-2 py-2 sm:px-4">
      <IconButton label={t("backToInbox")} asChild>
        <Link href="/messages">
          <ChevronLeftIcon aria-hidden="true" className="rtl:-scale-x-100" />
        </Link>
      </IconButton>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 px-2 py-1 text-start">
            <PersonAvatar person={person} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{person.displayName}</span>
              <span aria-live="polite" className="block truncate text-xs font-normal text-muted-foreground">
                {typing ? t("typing", { name: person.displayName }) : t("tapForProfile")}
              </span>
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          <div className="flex items-center gap-3">
            <PersonAvatar person={person} className="size-12" />
            <p className="min-w-0 truncate font-heading text-lg">{person.displayName}</p>
          </div>
          {thread.sharedDishes.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("theirDishes")}</p>
              <ul className="space-y-1">
                {thread.sharedDishes.map((dish) => (
                  <li key={dish.id}>
                    <Link
                      href={`/dishes/${dish.id}`}
                      className="flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm hover:bg-muted"
                    >
                      {dish.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dish.photoUrl}
                          alt=""
                          width={40}
                          height={30}
                          className="h-8 w-10 rounded object-cover"
                        />
                      ) : null}
                      <span className="truncate">{dish.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noSharedYet", { name: person.displayName })}</p>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href={`/friends/${person.id}`}>{t("viewProfile")}</Link>
          </Button>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={menuLabel}>
                <EllipsisVerticalIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{menuLabel}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem className="min-h-10" onSelect={() => void archive(!thread.archived)}>
            {thread.archived ? <ArchiveRestoreIcon aria-hidden="true" /> : <ArchiveIcon aria-hidden="true" />}
            {thread.archived ? t("unarchive") : t("archive")}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-10" onSelect={() => setDialog("clear")}>
            <Trash2Icon aria-hidden="true" />
            {t("deleteChat")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="min-h-10" onSelect={() => setDialog("report")}>
            <FlagIcon aria-hidden="true" />
            {t("reportPerson", { name: person.displayName })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "clear"}
        onOpenChange={(open) => setDialog(open ? "clear" : null)}
        title={t("deleteChatTitle")}
        description={t("deleteChatBody", { name: person.displayName })}
        confirmLabel={t("deleteChat")}
        onConfirm={async () => {
          const result = await clearConversation({ conversationId: thread.id });
          if (!result?.data) {
            toast.error(messages.action(result?.serverError));
            return false;
          }
          toast.success(t("chatDeleted"));
          router.push("/messages");
        }}
      />
      <ReportDialog
        open={dialog === "report"}
        onOpenChange={(open) => setDialog(open ? "report" : null)}
        targetType="user"
        targetId={person.id}
        subject={person.displayName}
      />
    </header>
  );
}
