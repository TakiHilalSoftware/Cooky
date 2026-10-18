"use client";

import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { revokeDevice, revokeOtherDevices } from "@/server/actions/security";
import type { DeviceDto } from "@/server/features/security/dto";

const KIND_ICON = { computer: LaptopIcon, phone: SmartphoneIcon, tablet: TabletIcon } as const;

export function DevicesCard({ devices }: { devices: DeviceDto[] }) {
  const t = useTranslations("settings.security.devices");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const messages = useFormMessages();
  const [confirmAll, setConfirmAll] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const revoke = useAction(revokeDevice);
  const revokeOthers = useAction(revokeOtherDevices);

  const others = devices.filter((device) => !device.current);
  const label = (device: DeviceDto) =>
    t("name", { browser: device.browser ?? t("unknownBrowser"), os: device.os ?? t("unknownOs") });

  async function signOut(device: DeviceDto) {
    setPendingId(device.id);
    const result = await revoke.executeAsync({ sessionId: device.id });
    setPendingId(null);
    if (result.serverError) toast.error(messages.action(result.serverError));
    else toast.success(t("signedOut"));
  }

  return (
    <SettingsSection
      title={t("heading")}
      description={t("description")}
      aside={
        others.length > 0 ? (
          <Button variant="outline" onClick={() => setConfirmAll(true)}>
            {t("signOutAll")}
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {devices.map((device) => {
          const Icon = KIND_ICON[device.kind];
          return (
            <li key={device.id} className="flex items-center gap-3 p-3 sm:p-4">
              <Icon aria-label={t(`kind.${device.kind}`)} className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="truncate">{label(device)}</span>
                  {device.current ? <Badge variant="secondary">{t("thisDevice")}</Badge> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  <time
                    dateTime={device.lastActiveAt}
                    title={format.dateTime(new Date(device.lastActiveAt), { dateStyle: "medium", timeStyle: "short" })}
                  >
                    {t("lastActive", { time: format.relativeTime(new Date(device.lastActiveAt), now) })}
                  </time>
                </p>
              </div>
              {device.current ? null : (
                <Button
                  variant="ghost"
                  aria-label={t("signOutLabel", { device: label(device) })}
                  disabled={pendingId === device.id}
                  onClick={() => signOut(device)}
                >
                  {pendingId === device.id ? <Spinner data-icon="inline-start" /> : null}
                  {t("signOut")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("onlyThisDevice")}</p> : null}

      {/* Wide impact, can't be undone: confirm first (PRD §3.10). */}
      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("signOutAllTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("signOutAllBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const result = await revokeOthers.executeAsync();
                if (result.serverError) toast.error(messages.action(result.serverError));
                else toast.success(t("signedOutAll"));
              }}
            >
              {t("signOutAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
