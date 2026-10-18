"use client";

import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** One-time backup codes, with copy and download so they actually get saved. */
export function BackupCodes({ codes }: { codes: string[] }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`Cooky backup codes\n\n${text}\n`], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "cooky-backup-codes.txt" });
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={copy} aria-live="polite">
          {copied ? (
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
          ) : (
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <DownloadIcon aria-hidden="true" data-icon="inline-start" />
          {t("settings.security.twoFactor.downloadCodes")}
        </Button>
      </div>
    </div>
  );
}
