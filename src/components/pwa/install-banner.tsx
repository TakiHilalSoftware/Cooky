"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { CookyIcon } from "@/components/brand/cooky-icon";
import { Button } from "@/components/ui/button";

import { useInstallPrompt } from "./install-provider";

/**
 * Non-intrusive floating banner for mobile & tablet web visitors.
 * Explains the offline and native capabilities of Cooky.
 * Respects user dismissal for 14 days and automatically hides once installed.
 */
export function InstallBanner() {
  const t = useTranslations("install");
  const { canInstall, isInstalled, isDismissed, promptToInstall, dismissBanner } = useInstallPrompt();

  if (isInstalled || isDismissed || !canInstall) return null;

  return (
    <aside
      aria-label={t("banner.title")}
      className="fixed bottom-20 start-4 end-4 z-40 mx-auto max-w-md rounded-2xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md sm:bottom-6 sm:end-6 sm:start-auto sm:w-96 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <CookyIcon className="size-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-sm font-semibold text-foreground">{t("banner.title")}</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={dismissBanner}
              className="-me-1 -mt-1 size-7 text-muted-foreground hover:text-foreground"
              aria-label={t("banner.dismiss")}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("banner.description")}</p>

          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void promptToInstall()}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              <span>{t("banner.action")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={dismissBanner}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("banner.dismiss")}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
