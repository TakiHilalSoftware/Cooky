import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextIntlClientProvider } from "next-intl";
import { CATALOGS } from "../../../tests/setup/render";
import { _resetInstalledSessionForTesting, InstallProvider, useInstallPrompt } from "./install-provider";

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={CATALOGS.en}>
      <InstallProvider>{children}</InstallProvider>
    </NextIntlClientProvider>
  );
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInstalledSessionForTesting();
    vi.restoreAllMocks();
  });

  it("throws error if used outside InstallProvider", () => {
    expect(() => renderHook(() => useInstallPrompt())).toThrow(
      "useInstallPrompt must be used within an InstallProvider",
    );
  });

  it("provides initial state inside InstallProvider", () => {
    const { result } = renderHook(() => useInstallPrompt(), {
      wrapper: TestWrapper,
    });

    expect(result.current.isInstalled).toBe(false);
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isDismissed).toBe(false);
    expect(result.current.iosDialogOpen).toBe(false);
  });

  it("updates canInstall when beforeinstallprompt event is fired", () => {
    const { result } = renderHook(() => useInstallPrompt(), {
      wrapper: TestWrapper,
    });

    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
      platforms: ["web"],
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it("updates isInstalled when appinstalled event is fired", () => {
    const { result } = renderHook(() => useInstallPrompt(), {
      wrapper: TestWrapper,
    });

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it("marks isDismissed and persists to localStorage on dismissBanner()", () => {
    const { result } = renderHook(() => useInstallPrompt(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.dismissBanner();
    });

    expect(result.current.isDismissed).toBe(true);
    expect(localStorage.getItem("cooky_install_dismissed_at")).toBeTruthy();
  });
});
