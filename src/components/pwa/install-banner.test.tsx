import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";
import { InstallBanner } from "./install-banner";
import { _resetInstalledSessionForTesting, InstallProvider } from "./install-provider";

function triggerBeforeInstallPrompt() {
  const promptMock = vi.fn().mockResolvedValue(undefined);
  const userChoiceMock = Promise.resolve({ outcome: "dismissed" as const, platform: "web" });
  const event = new Event("beforeinstallprompt");
  Object.assign(event, {
    prompt: promptMock,
    userChoice: userChoiceMock,
    platforms: ["web"],
  });
  window.dispatchEvent(event);
  return { promptMock };
}

describe("InstallBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInstalledSessionForTesting();
    vi.restoreAllMocks();
  });

  it("is hidden initially when beforeinstallprompt has not fired", () => {
    const { container } = renderWithIntl(
      <InstallProvider>
        <InstallBanner />
      </InstallProvider>,
    );
    expect(container.querySelector("aside")).toBeNull();
  });

  it("appears when beforeinstallprompt event is dispatched", async () => {
    renderWithIntl(
      <InstallProvider>
        <InstallBanner />
      </InstallProvider>,
    );

    act(() => {
      triggerBeforeInstallPrompt();
    });

    expect(screen.getByRole("complementary", { name: "Install Cooky" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dismiss" }).length).toBeGreaterThan(0);
  });

  it("dismisses and hides when Dismiss button is clicked", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <InstallProvider>
        <InstallBanner />
      </InstallProvider>,
    );

    act(() => {
      triggerBeforeInstallPrompt();
    });

    const dismissBtns = screen.getAllByRole("button", { name: "Dismiss" });
    await user.click(dismissBtns[0]!);

    expect(screen.queryByRole("complementary", { name: "Install Cooky" })).toBeNull();
    expect(localStorage.getItem("cooky_install_dismissed_at")).toBeTruthy();
  });

  it("triggers prompt when Install button is clicked", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <InstallProvider>
        <InstallBanner />
      </InstallProvider>,
    );

    let promptFn: () => Promise<void>;
    act(() => {
      const { promptMock } = triggerBeforeInstallPrompt();
      promptFn = promptMock;
    });

    const installBtn = screen.getByRole("button", { name: "Install" });
    await user.click(installBtn);

    expect(promptFn!).toHaveBeenCalledTimes(1);
  });
});
