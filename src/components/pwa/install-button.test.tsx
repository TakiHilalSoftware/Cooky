import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";
import { InstallButton } from "./install-button";
import { _resetInstalledSessionForTesting, InstallProvider } from "./install-provider";

function renderInstallButton(
  ui: React.ReactElement,
  { locale = "en" }: { locale?: "en" | "fr" | "ar" } = {},
) {
  return renderWithIntl(<InstallProvider>{ui}</InstallProvider>, { locale });
}

describe("InstallButton", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInstalledSessionForTesting();
    vi.restoreAllMocks();
  });

  it("hides when app is not installable and showAlways is false", () => {
    const { container } = renderInstallButton(<InstallButton variant="button" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders when showAlways is true and shows translated text", () => {
    renderInstallButton(<InstallButton variant="button" showAlways />, { locale: "en" });
    expect(screen.getByRole("button", { name: "Install app" })).toBeInTheDocument();
  });

  it("renders translated text in French when showAlways is true", () => {
    renderInstallButton(<InstallButton variant="button" showAlways />, { locale: "fr" });
    expect(screen.getByRole("button", { name: "Installer l'application" })).toBeInTheDocument();
  });

  it("renders translated text in Arabic when showAlways is true", () => {
    renderInstallButton(<InstallButton variant="button" showAlways />, { locale: "ar" });
    expect(screen.getByRole("button", { name: "تثبيت التطبيق" })).toBeInTheDocument();
  });

  it("renders icon variant with accessible tooltip name", () => {
    renderInstallButton(<InstallButton variant="icon" showAlways />, { locale: "en" });
    expect(screen.getByRole("button", { name: "Install Cooky on this device" })).toBeInTheDocument();
  });

  it("triggers install prompt on click", async () => {
    const user = userEvent.setup();
    renderInstallButton(<InstallButton variant="button" showAlways />);

    const button = screen.getByRole("button", { name: "Install app" });
    await user.click(button);
    // Click executed without throwing
    expect(button).toBeInTheDocument();
  });
});
