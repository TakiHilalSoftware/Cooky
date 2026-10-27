"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { OFFLINE_SETTING_KEY, offlineEnabled, wipeOffline } from "@/components/offline/store";
import { InstallButton, useInstallPrompt } from "@/components/pwa";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { SettingsSection } from "./settings-section";

const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

/**
 * "On this device" (PRD §4): keep the shopping list and today's recipe here
 * for offline use. On by default; turning it off wipes what's stored.
 */
export function OfflineCard() {
  const t = useTranslations("settings.offline");
  const tInstall = useTranslations("install");
  const { isInstalled } = useInstallPrompt();
  const enabled = useSyncExternalStore(subscribe, offlineEnabled, () => true);

  async function change(on: boolean) {
    try {
      localStorage.setItem(OFFLINE_SETTING_KEY, on ? "on" : "off");
    } catch {
      // Storage blocked: nothing is kept anyway.
    }
    if (!on) await wipeOffline();
    listeners.forEach((notify) => notify());
    toast.success(on ? t("turnedOn") : t("turnedOff"));
  }

  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="offline-copy"
            checked={enabled}
            onCheckedChange={(v) => void change(v === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="offline-copy">{t("label")}</Label>
            <p className="text-sm text-muted-foreground">{t("hint")}</p>
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-foreground">{tInstall("settingsLabel")}</span>
              <p className="text-sm text-muted-foreground">
                {isInstalled ? tInstall("settingsInstalled") : tInstall("settingsNotInstalled")}
              </p>
            </div>
            {isInstalled ? (
              <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-strong">
                <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                <span>{tInstall("installed")}</span>
              </div>
            ) : (
              <InstallButton variant="button" size="sm" showAlways className="shrink-0" />
            )}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
