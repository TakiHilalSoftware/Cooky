import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ verifyTwoFactorCode: vi.fn(), verifyBackupCode: vi.fn() }));
vi.mock("@/server/actions/auth", () => actions);
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const { TwoFactorForm } = await import("./two-factor-form");

beforeEach(() => {
  actions.verifyTwoFactorCode.mockReset();
  actions.verifyBackupCode.mockReset();
});

describe("TwoFactorForm", () => {
  it("verifies as soon as six digits are typed, without an extra tap", async () => {
    const user = userEvent.setup();
    actions.verifyTwoFactorCode.mockResolvedValue({ data: { status: "invalid_code" } });
    renderWithIntl(<TwoFactorForm next="/settings/security" />);
    await user.keyboard("123456");
    await waitFor(() =>
      expect(actions.verifyTwoFactorCode).toHaveBeenCalledWith({
        code: "123456",
        trustDevice: false,
        next: "/settings/security",
        locale: "en",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work.");
  });

  it("switches to a backup code, explained in plain words", async () => {
    const user = userEvent.setup();
    actions.verifyBackupCode.mockResolvedValue({ data: { status: "invalid_code" } });
    renderWithIntl(<TwoFactorForm />);
    await user.click(screen.getByRole("button", { name: "Use a backup code instead" }));
    await user.type(screen.getByLabelText("Backup code"), "abcde-12345");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Each code works only once.");
    expect(actions.verifyTwoFactorCode).not.toHaveBeenCalled();
  });

  it("sends the person back to log in when the sign-in window expired", async () => {
    const user = userEvent.setup();
    actions.verifyTwoFactorCode.mockResolvedValue({ data: { status: "expired" } });
    renderWithIntl(<TwoFactorForm />);
    await user.keyboard("654321");
    expect(await screen.findByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
  });
});
