"use client";

import { BanIcon, EllipsisVerticalIcon, FlagIcon, UserMinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";
import { blockUser, unfriend } from "@/server/actions/friends";
import type { PersonDto } from "@/server/features/social/dto";

import { ReportDialog } from "./report-dialog";

type PersonMenuProps = {
  person: Pick<PersonDto, "id" | "displayName" | "relation">;
  /** Where to go after blocking (they disappear from wherever you were). */
  afterBlock?: "/friends";
};

/** Unfriend, block and report: the less common actions with someone, behind "More". */
export function PersonMenu({ person, afterBlock }: PersonMenuProps) {
  const t = useTranslations("friends");
  const messages = useFormMessages();
  const online = useOnline();
  const router = useRouter();
  const [dialog, setDialog] = useState<"unfriend" | "block" | "report" | null>(null);
  const label = t("moreFor", { name: person.displayName });

  async function guarded(call: () => Promise<{ data?: unknown; serverError?: unknown } | undefined>) {
    if (!online) {
      toast.error(t("offline"));
      return false;
    }
    const result = await call();
    if (result?.data) return true;
    toast.error(messages.action(result?.serverError));
    return false;
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={label}>
                <EllipsisVerticalIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          {person.relation === "friend" ? (
            <DropdownMenuItem className="min-h-10" onSelect={() => setDialog("unfriend")}>
              <UserMinusIcon aria-hidden="true" />
              {t("unfriend")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="min-h-10" onSelect={() => setDialog("block")}>
            <BanIcon aria-hidden="true" />
            {t("block")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="min-h-10" onSelect={() => setDialog("report")}>
            <FlagIcon aria-hidden="true" />
            {t("report")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "unfriend"}
        onOpenChange={(open) => setDialog(open ? "unfriend" : null)}
        title={t("unfriendTitle", { name: person.displayName })}
        description={t("unfriendBody", { name: person.displayName })}
        confirmLabel={t("unfriend")}
        onConfirm={async () => {
          const ok = await guarded(() => unfriend({ userId: person.id }));
          if (ok) toast.success(t("unfriended", { name: person.displayName }));
          return ok;
        }}
      />
      <ConfirmDialog
        open={dialog === "block"}
        onOpenChange={(open) => setDialog(open ? "block" : null)}
        title={t("blockTitle", { name: person.displayName })}
        description={t("blockBody", { name: person.displayName })}
        confirmLabel={t("block")}
        onConfirm={async () => {
          const ok = await guarded(() => blockUser({ userId: person.id }));
          if (ok) {
            toast.success(t("blocked", { name: person.displayName }));
            if (afterBlock) router.replace(afterBlock);
          }
          return ok;
        }}
      />
      <ReportDialog
        open={dialog === "report"}
        onOpenChange={(open) => setDialog(open ? "report" : null)}
        targetType="user"
        targetId={person.id}
        subject={person.displayName}
      />
    </>
  );
}
