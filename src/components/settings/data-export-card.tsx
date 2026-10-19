"use client";

import { DownloadIcon, FileArchiveIcon, RotateCcwIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { requestDataExport } from "@/server/actions/account";
import type { YourDataDto } from "@/server/features/account/dto";

import { SettingsSection } from "./settings-section";

/** While an export is being prepared, the card checks back this often. */
const POLL_MS = 5000;

/** Download your data (PRD §3.1): prepared in the background, then a link that works for a day. */
export function DataExportCard({ data }: { data: YourDataDto["export"] }) {
  const t = useTranslations("yourData.export");
  const format = useFormatter();
  const now = useNow();
  const messages = useFormMessages();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const working = data?.status === "queued" || data?.status === "running";

  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [working, router]);

  async function prepare() {
    setPending(true);
    const result = await requestDataExport({});
    setPending(false);
    if (result?.data) return toast.success(t("started"));
    toast.error(result?.serverError === "rate_limited" ? t("tooSoon") : messages.action(result?.serverError));
  }

  const prepareButton = (label: string) => (
    <Button variant="outline" onClick={() => void prepare()} disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />}
      {label}
    </Button>
  );

  return (
    <SettingsSection
      title={t("heading")}
      description={t("description")}
      aside={
        !data ? (
          <Button onClick={() => void prepare()} disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <FileArchiveIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {t("prepare")}
          </Button>
        ) : null
      }
    >
      {data ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted p-4">
          {working ? (
            <p className="flex items-center gap-2 text-sm">
              <Spinner /> {t("working")}
            </p>
          ) : data.status === "ready" && data.downloadPath ? (
            <>
              <p className="text-sm">
                {t("ready", {
                  size: format.number((data.sizeBytes ?? 0) / 1024, { maximumFractionDigits: 0 }),
                  time: format.relativeTime(new Date(data.expiresAt ?? now), now),
                })}
              </p>
              <Button asChild>
                {/* A plain link: the file streams from Cooky with the owner's session. */}
                <a href={data.downloadPath} download>
                  <DownloadIcon aria-hidden="true" data-icon="inline-start" />
                  {t("download")}
                </a>
              </Button>
            </>
          ) : data.status === "failed" ? (
            <>
              <p className="text-sm">{t("failed")}</p>
              {prepareButton(t("tryAgain"))}
            </>
          ) : (
            <>
              <p className="text-sm">{t("expired")}</p>
              {prepareButton(t("prepareAgain"))}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("whatsIncluded")}</p>
      )}
    </SettingsSection>
  );
}
