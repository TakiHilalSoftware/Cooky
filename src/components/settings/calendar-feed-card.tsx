"use client";

import { CopyIcon, LinkIcon, LockIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createCalendarFeed, revokeCalendarFeed } from "@/server/actions/calendar-feed";
import type { CalendarFeedDto } from "@/server/features/calendar-feed/dto";

import { SettingsSection } from "./settings-section";

/**
 * Settings → Calendar feed (Pro, PRD §3.5): a secret link for Google, Apple or
 * Outlook Calendar. The link shows once; a new one replaces it; off revokes it.
 */
export function CalendarFeedCard({ feed }: { feed: CalendarFeedDto }) {
  const t = useTranslations("settings.calendarFeed");
  const format = useFormatter();
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const result = await createCalendarFeed({});
    setBusy(false);
    if (result?.data) return setUrl(result.data.url);
    onActionError(result?.serverError, "ical_feed");
  }

  async function revoke() {
    setBusy(true);
    const result = await revokeCalendarFeed({});
    setBusy(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    setUrl(null);
    toast.success(t("revoked"));
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      // Clipboard blocked: the link is selectable in the field.
    }
  }

  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      {!feed.available ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockIcon aria-hidden="true" className="size-4" />
            {t("proOnly")}
          </p>
          <Button variant="outline" onClick={() => onActionError("plan_required", "ical_feed")}>
            {t("seePlans")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {url ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("yourLink")}</p>
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label={t("yourLink")} onFocus={(e) => e.target.select()} dir="ltr" />
                <Button variant="outline" onClick={copy}>
                  <CopyIcon aria-hidden="true" data-icon="inline-start" />
                  {t("copy")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t("onlyOnce")}</p>
            </div>
          ) : feed.active && feed.createdAt ? (
            <p className="text-sm">
              {t("activeSince", { date: format.dateTime(new Date(feed.createdAt), { dateStyle: "long" }) })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={create}>
              {busy ? <Spinner data-icon="inline-start" /> : <LinkIcon aria-hidden="true" data-icon="inline-start" />}
              {feed.active || url ? t("newLink") : t("create")}
            </Button>
            {feed.active || url ? (
              <Button variant="ghost" disabled={busy} onClick={revoke}>
                {t("turnOff")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        </div>
      )}
    </SettingsSection>
  );
}
