"use client";

import { BookOpenIcon, CopyIcon, FlagIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { IconButton } from "@/components/feedback/icon-button";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { asAppLocale } from "@/i18n/routing";
import { copyFriendDish } from "@/server/actions/sharing";

import { ReportDialog } from "./report-dialog";

type FriendDishActionsProps = { dishId: string; name: string; myCopyId: string | null };

/** Copy a friend's dish (within your plan's dish cap) or open your copy; report it. */
export function FriendDishActions({ dishId, name, myCopyId }: FriendDishActionsProps) {
  const t = useTranslations("sharing.friendDish");
  const locale = asAppLocale(useLocale());
  const online = useOnline();
  const router = useRouter();
  const onActionError = useActionErrorHandler();
  const [copying, setCopying] = useState(false);
  const [reporting, setReporting] = useState(false);

  async function copy() {
    if (!online) return toast.error(t("offline"));
    setCopying(true);
    const result = await copyFriendDish({ dishId, locale });
    setCopying(false);
    if (result?.data) {
      toast.success(t("copied", { name }));
      return router.push(`/dishes/${result.data.id}`);
    }
    onActionError(result?.serverError, "dishes");
  }

  return (
    <div className="flex items-center gap-1">
      {myCopyId ? (
        <Button asChild variant="outline">
          <Link href={`/dishes/${myCopyId}`}>
            <BookOpenIcon aria-hidden="true" data-icon="inline-start" />
            {t("openCopy")}
          </Link>
        </Button>
      ) : (
        <Button onClick={() => void copy()} disabled={copying}>
          {copying ? <Spinner data-icon="inline-start" /> : <CopyIcon aria-hidden="true" data-icon="inline-start" />}
          {t("copy")}
        </Button>
      )}
      <IconButton label={t("report", { name })} onClick={() => setReporting(true)}>
        <FlagIcon aria-hidden="true" />
      </IconButton>
      <ReportDialog open={reporting} onOpenChange={setReporting} targetType="dish" targetId={dishId} subject={name} />
    </div>
  );
}
