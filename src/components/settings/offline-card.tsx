"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { OFFLINE_SETTING_KEY, offlineEnabled, wipeOffline } from "@/components/offline/store";
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
    </SettingsSection>
  );
}
