"use client";

import { CircleAlertIcon, CircleCheckIcon, DownloadIcon, UploadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler, useUpgradeSheet } from "@/components/paywall/upgrade-sheet-provider";
import { SettingsSection } from "@/components/settings/settings-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { exportBackup, importBackup } from "@/server/actions/backup";
import type { BackupImportDto, BackupOverviewDto } from "@/server/features/backup/dto";

/** Check on a running import this often. */
const POLL_MS = 3_000;
/** The same 5 MB the server enforces, so a big file is turned away before uploading. */
const MAX_BYTES = 5 * 1024 * 1024;

/** Settings → Your data: download a recipe backup, or import one (PRD §3.2). */
export function BackupCard({ overview }: { overview: BackupOverviewDto }) {
  const t = useTranslations("backup");
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const openUpgrade = useUpgradeSheet();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const exporter = useAction(exportBackup);
  const importer = useAction(importBackup);
  const running = overview.latestImport?.status === "queued" || overview.latestImport?.status === "running";

  // While an import runs in the background, quietly re-read the result.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  async function download() {
    const result = await exporter.executeAsync();
    if (!result.data) return toast.error(messages.action(result.serverError));
    const url = URL.createObjectURL(new Blob([result.data.content], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: result.data.filename });
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("exported"));
  }

  function chooseFile() {
    if (!overview.canImport) return openUpgrade({ feature: "backup_import", reason: "plan_required" });
    fileInput.current?.click();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // Choosing the same file again should work too.
    if (!file) return;
    setProblem(null);
    if (file.size > MAX_BYTES) return setProblem(t("problem.too_large"));
    const result = await importer.executeAsync({ content: await file.text() });
    const data = result.data;
    if (data?.status === "queued") {
      toast.success(t("queued", { count: data.total }));
      router.refresh();
    } else if (data?.status === "invalid") setProblem(t(`problem.${data.problem}`));
    else if (data?.status === "busy") setProblem(t("busy"));
    else if (result.serverError === "plan_required") onActionError(result.serverError, "backup_import");
    else setProblem(messages.action(result.serverError));
  }

  return (
    <>
      <SettingsSection title={t("exportHeading")} description={t("exportBody")}>
        {overview.dishCount === 0 ? (
          <p className="text-sm text-muted-foreground">{t("exportEmpty")}</p>
        ) : (
          <Button variant="outline" onClick={download} disabled={exporter.isPending}>
            {exporter.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <DownloadIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {exporter.isPending ? t("exporting") : t("exportButton", { count: overview.dishCount })}
          </Button>
        )}
      </SettingsSection>

      <SettingsSection title={t("importHeading")} description={t("importBody")}>
        <div className="space-y-4">
          {overview.latestImport ? <ImportStatus latest={overview.latestImport} /> : null}
          {problem ? (
            <Alert variant="destructive" aria-live="polite">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={onFile}
            />
            <Button onClick={chooseFile} disabled={importer.isPending || running}>
              {importer.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {importer.isPending ? t("importing") : t("importButton")}
            </Button>
            <p className="text-xs text-muted-foreground">{overview.canImport ? t("importHint") : t("importPaid")}</p>
          </div>
        </div>
      </SettingsSection>
    </>
  );
}

function ImportStatus({ latest }: { latest: BackupImportDto }) {
  const t = useTranslations("backup");
  const format = useFormatter();

  if (latest.status === "queued" || latest.status === "running") {
    return (
      <Alert role="status">
        <Spinner aria-hidden="true" />
        <AlertTitle>{t("runningTitle")}</AlertTitle>
        <AlertDescription>{t("runningBody")}</AlertDescription>
      </Alert>
    );
  }
  if (latest.status === "failed") {
    return (
      <Alert role="status" variant="destructive">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>{t("failedTitle")}</AlertTitle>
        <AlertDescription>{t("failedBody")}</AlertDescription>
      </Alert>
    );
  }
  const reasons = (
    [
      ["skippedDuplicate", latest.skipped.duplicate],
      ["skippedFull", latest.skipped.full],
      ["skippedInvalid", latest.skipped.invalid],
    ] as const
  ).filter(([, n]) => n > 0);
  return (
    <Alert role="status">
      <CircleCheckIcon aria-hidden="true" className="text-primary-strong" />
      <AlertTitle>{t("doneTitle", { count: latest.imported })}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {t("doneOf", {
            count: latest.total,
            date: format.dateTime(new Date(latest.createdAt), { dateStyle: "medium", timeStyle: "short" }),
          })}
        </p>
        {reasons.length > 0 ? (
          <ul className="list-disc space-y-0.5 ps-5">
            {reasons.map(([key, n]) => (
              <li key={key}>{t(key, { count: n })}</li>
            ))}
          </ul>
        ) : null}
        {latest.imported > 0 ? (
          <Link href="/dishes" className="font-medium text-primary-strong underline-offset-4 hover:underline">
            {t("viewDishes")}
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
