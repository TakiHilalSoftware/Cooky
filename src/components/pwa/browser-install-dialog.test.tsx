import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";
import { BrowserInstallDialog } from "./browser-install-dialog";

describe("BrowserInstallDialog", () => {
  it("renders tips for desktop browsers and Safari in English", () => {
    const handleClose = vi.fn();
    renderWithIntl(<BrowserInstallDialog open={true} onOpenChange={handleClose} />, { locale: "en" });

    expect(screen.getByRole("heading", { name: "How to install Cooky" })).toBeInTheDocument();
    expect(screen.getByText("Chrome, Edge & Brave")).toBeInTheDocument();
    expect(screen.getByText(/click the Install icon in the right side of the address bar/)).toBeInTheDocument();
  });

  it("renders tips in French", () => {
    const handleClose = vi.fn();
    renderWithIntl(<BrowserInstallDialog open={true} onOpenChange={handleClose} />, { locale: "fr" });

    expect(screen.getByRole("heading", { name: "Comment installer Cooky" })).toBeInTheDocument();
    expect(screen.getByText(/cliquez sur l'icône d'installation à droite de la barre d'adresse/)).toBeInTheDocument();
  });

  it("renders tips in Arabic", () => {
    const handleClose = vi.fn();
    renderWithIntl(<BrowserInstallDialog open={true} onOpenChange={handleClose} />, { locale: "ar" });

    expect(screen.getByRole("heading", { name: "كيفية تثبيت كوكيز" })).toBeInTheDocument();
    expect(screen.getByText(/اضغط على أيقونة التثبيت في شريط العنوان/)).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Got it button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    renderWithIntl(<BrowserInstallDialog open={true} onOpenChange={handleClose} />, { locale: "en" });

    const closeBtn = screen.getByRole("button", { name: "Got it" });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledWith(false);
  });
});
