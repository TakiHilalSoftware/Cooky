"use client";

import { BellIcon, BellOffIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { asAppLocale } from "@/i18n/routing";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/social";
import { removePushSubscription, savePushSubscription, setNotificationPrefs } from "@/server/actions/notifications";
import type { NotificationSettingsDto } from "@/server/features/social/dto";

import { SettingsSection } from "./settings-section";

/** Why push can't be turned on here, in the person's words. */
type Blocker = "server" | "unsupported" | "ios" | "denied" | null;
type DeviceState = { status: "checking" } | { status: "ready"; on: boolean; blocker: Blocker };

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** iPhones and iPads only allow web push from the app added to the Home Screen. */
function isIosBrowserTab(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios && !window.matchMedia("(display-mode: standalone)").matches;
}

/** Settings → Notifications (PRD §3.6): push on this device, and which kinds to get. */
export function NotificationsCard({ settings }: { settings: NotificationSettingsDto }) {
  const t = useTranslations("settings.notifications");
  const messages = useFormMessages();
  const locale = asAppLocale(useLocale());
  const [device, setDevice] = useState<DeviceState>({ status: "checking" });
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState<NotificationKind[]>(settings.off);

  useEffect(() => {
    void (async () => {
      if (!settings.vapidPublicKey) return setDevice({ status: "ready", on: false, blocker: "server" });
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setDevice({ status: "ready", on: false, blocker: isIosBrowserTab() ? "ios" : "unsupported" });
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setDevice({
        status: "ready",
        on: Boolean(subscription) && Notification.permission === "granted",
        blocker: Notification.permission === "denied" ? "denied" : null,
      });
    })();
  }, [settings.vapidPublicKey]);

  async function turnOn() {
    if (!settings.vapidPublicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice({ status: "ready", on: false, blocker: permission === "denied" ? "denied" : null });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(settings.vapidPublicKey),
        }));
      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: bytesToBase64Url(subscription.getKey("p256dh")),
        auth: bytesToBase64Url(subscription.getKey("auth")),
        locale,
      });
      if (!result?.data) {
        await subscription.unsubscribe();
        return toast.error(messages.action(result?.serverError));
      }
      setDevice({ status: "ready", on: true, blocker: null });
      toast.success(t("turnedOn"));
    } catch {
      toast.error(t("couldNotTurnOn"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setDevice({ status: "ready", on: false, blocker: null });
      toast.success(t("turnedOff"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleKind(kind: NotificationKind, enabled: boolean) {
    const next = enabled ? off.filter((k) => k !== kind) : [...off, kind];
    const before = off;
    setOff(next);
    const result = await setNotificationPrefs({ off: next });
    if (!result?.data) {
      setOff(before);
      toast.error(messages.action(result?.serverError));
    }
  }

  const status =
    device.status === "checking" ? (
      <Spinner aria-label={t("checking")} />
    ) : device.on ? (
      <Button variant="outline" onClick={() => void turnOff()} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : <BellOffIcon aria-hidden="true" data-icon="inline-start" />}
        {t("turnOff")}
      </Button>
    ) : device.blocker ? null : (
      <Button onClick={() => void turnOn()} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : <BellIcon aria-hidden="true" data-icon="inline-start" />}
        {t("turnOn")}
      </Button>
    );

  return (
    <div className="space-y-6">
      <SettingsSection title={t("pushHeading")} description={t("pushDescription")} aside={status}>
        {device.status === "ready" && device.blocker ? (
          <Alert role="status">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{t(`blocker.${device.blocker}`)}</AlertDescription>
          </Alert>
        ) : device.status === "ready" ? (
          <p className="text-sm text-muted-foreground">{device.on ? t("onHere") : t("offHere")}</p>
        ) : null}
      </SettingsSection>

      <SettingsSection title={t("kindsHeading")} description={t("kindsDescription")}>
        <ul className="divide-y divide-border">
          {NOTIFICATION_KINDS.map((kind) => {
            const id = `notify-${kind}`;
            return (
              <li key={kind}>
                <Label htmlFor={id} className="flex min-h-14 items-center gap-3 py-2 font-normal">
                  <Checkbox
                    id={id}
                    checked={!off.includes(kind)}
                    onCheckedChange={(value) => void toggleKind(kind, value === true)}
                  />
                  <span className="space-y-0.5">
                    <span className="block font-medium">{t(`kind.${kind}.label`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`kind.${kind}.hint`)}</span>
                  </span>
                </Label>
              </li>
            );
          })}
        </ul>
      </SettingsSection>
    </div>
  );
}
