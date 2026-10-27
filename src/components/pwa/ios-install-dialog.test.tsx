import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";
import { IosInstallDialog } from "./ios-install-dialog";

describe("IosInstallDialog", () => {
  it("renders 3 sequential steps with titles and descriptions in English", () => {
    const handleClose = vi.fn();
    renderWithIntl(<IosInstallDialog open={true} onOpenChange={handleClose} />, { locale: "en" });

    expect(screen.getByRole("heading", { name: "Install Cooky on iPhone or iPad" })).toBeInTheDocument();
    expect(screen.getByText("Tap the Share button")).toBeInTheDocument();
    expect(screen.getByText("Choose 'Add to Home Screen'")).toBeInTheDocument();
    expect(screen.getByText("Confirm and tap 'Add'")).toBeInTheDocument();
  });

  it("renders translated steps in French", () => {
    const handleClose = vi.fn();
    renderWithIntl(<IosInstallDialog open={true} onOpenChange={handleClose} />, { locale: "fr" });

    expect(screen.getByRole("heading", { name: "Installer Cooky sur iPhone ou iPad" })).toBeInTheDocument();
    expect(screen.getByText("Appuyez sur le bouton Partager")).toBeInTheDocument();
    expect(screen.getByText("Choisissez « Sur l'écran d'accueil »")).toBeInTheDocument();
    expect(screen.getByText("Confirmez avec « Ajouter »")).toBeInTheDocument();
  });

  it("renders translated steps in Arabic", () => {
    const handleClose = vi.fn();
    renderWithIntl(<IosInstallDialog open={true} onOpenChange={handleClose} />, { locale: "ar" });

    expect(screen.getByRole("heading", { name: "تثبيت كوكيز على آيفون أو آيباد" })).toBeInTheDocument();
    expect(screen.getByText("اضغط على زر المشاركة")).toBeInTheDocument();
    expect(screen.getByText("اختر 'إضافة إلى الشاشة الرئيسية'")).toBeInTheDocument();
    expect(screen.getByText("أكّد بالضغط على 'إضافة'")).toBeInTheDocument();
  });

  it("invokes onOpenChange(false) when the Got it button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    renderWithIntl(<IosInstallDialog open={true} onOpenChange={handleClose} />, { locale: "en" });

    const closeBtn = screen.getByRole("button", { name: "Got it" });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledWith(false);
  });
});
