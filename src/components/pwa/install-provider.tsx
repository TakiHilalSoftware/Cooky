"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { BrowserInstallDialog } from "./browser-install-dialog";
import { IosInstallDialog } from "./ios-install-dialog";
import type { BeforeInstallPromptEvent, InstallContextValue, InstallOutcome } from "./types";

const INSTALL_DISMISSED_KEY = "cooky_install_dismissed_at";
const DISMISSAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const InstallContext = createContext<InstallContextValue | null>(null);

let installedSession = false;

export function _resetInstalledSessionForTesting(): void {
  installedSession = false;
}

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (installedSession) return true;
  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standaloneMedia || navigatorStandalone;
}

function subscribeStandalone(notify: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(display-mode: standalone)");
  const onAppInstalled = () => {
    installedSession = true;
    notify();
  };
  window.addEventListener("appinstalled", onAppInstalled);
  media.addEventListener("change", notify);
  return () => {
    window.removeEventListener("appinstalled", onAppInstalled);
    media.removeEventListener("change", notify);
  };
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isIpadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isIos || isIpadOs;
}

function subscribeIos(): () => void {
  return () => {};
}

const dismissalListeners = new Set<() => void>();

function isDismissalActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number.parseInt(raw, 10);
    return Date.now() - dismissedAt < DISMISSAL_DURATION_MS;
  } catch {
    return false;
  }
}

function subscribeDismissal(notify: () => void): () => void {
  dismissalListeners.add(notify);
  return () => {
    dismissalListeners.delete(notify);
  };
}

export function InstallProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("install");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);
  const [browserDialogOpen, setBrowserDialogOpen] = useState(false);

  const isInstalled = useSyncExternalStore(subscribeStandalone, isRunningStandalone, () => false);
  const isIos = useSyncExternalStore(subscribeIos, isIosDevice, () => false);
  const isDismissed = useSyncExternalStore(subscribeDismissal, isDismissalActive, () => false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // Storage unavailable or blocked
    }
    dismissalListeners.forEach((notify) => notify());
  }, []);

  const promptToInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (isInstalled) return "unavailable";

    if (isIos) {
      setIosDialogOpen(true);
      return "ios_guide";
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
          toast.success(t("successToast"));
        }
        return outcome;
      } catch {
        return "unavailable";
      }
    }

    // Cooldown or browser without automated prompt: open universal guidance
    setBrowserDialogOpen(true);
    return "browser_guide";
  }, [deferredPrompt, isInstalled, isIos, t]);

  const canInstall = useMemo(() => {
    if (isInstalled) return false;
    return isIos || deferredPrompt !== null;
  }, [isInstalled, isIos, deferredPrompt]);

  const value = useMemo<InstallContextValue>(
    () => ({
      isInstalled,
      isIos,
      canInstall,
      isDismissed,
      iosDialogOpen,
      setIosDialogOpen,
      browserDialogOpen,
      setBrowserDialogOpen,
      promptToInstall,
      dismissBanner,
    }),
    [
      isInstalled,
      isIos,
      canInstall,
      isDismissed,
      iosDialogOpen,
      browserDialogOpen,
      promptToInstall,
      dismissBanner,
    ],
  );

  return (
    <InstallContext.Provider value={value}>
      {children}
      <IosInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
      <BrowserInstallDialog open={browserDialogOpen} onOpenChange={setBrowserDialogOpen} />
    </InstallContext.Provider>
  );
}

export function useInstallPrompt(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) {
    throw new Error("useInstallPrompt must be used within an InstallProvider");
  }
  return ctx;
}
