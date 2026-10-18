import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  resendVerification: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("@/server/actions/auth", () => actions);
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SignUpForm } = await import("./sign-up-form");
const { LogInForm } = await import("./log-in-form");
const { RequestLinkForm } = await import("./request-link-form");

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});

async function fillSignUp(user: ReturnType<typeof userEvent.setup>, overrides: Partial<Record<string, string>> = {}) {
  await user.type(screen.getByLabelText("Your name"), overrides.name ?? "Amina");
  await user.type(screen.getByLabelText("Email"), overrides.email ?? "amina@example.com");
  await user.type(screen.getByLabelText("Password"), overrides.password ?? "correct horse battery");
}

describe("SignUpForm", () => {
  it("explains every problem inline, focuses the first one, and doesn't call the server", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Your name")).toHaveAccessibleDescription(/Enter your name\./);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Agree to the Terms and Privacy Policy to continue.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveFocus();
    expect(actions.signUp).not.toHaveBeenCalled();
  });

  it("requires the consent box even when everything else is valid", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    await fillSignUp(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
    expect(actions.signUp).not.toHaveBeenCalled();
  });

  it("sends normalised input and then shows where the confirmation link went", async () => {
    const user = userEvent.setup();
    actions.signUp.mockResolvedValue({ data: { status: "check_email" } });
    renderWithIntl(<SignUpForm />, { locale: "en" });
    await fillSignUp(user, { email: "  Amina@Example.com " });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(actions.signUp).toHaveBeenCalledWith({
        name: "Amina",
        email: "amina@example.com",
        password: "correct horse battery",
        acceptTerms: true,
        locale: "en",
      }),
    );
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/We sent a link to amina@example.com\./)).toBeInTheDocument();
  });

  it("flags a breached password on the password field itself", async () => {
    const user = userEvent.setup();
    actions.signUp.mockResolvedValue({ data: { status: "password_compromised" } });
    renderWithIntl(<SignUpForm />);
    await fillSignUp(user, { password: "password123" });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(/appeared in a data breach/),
    );
  });

  it("links the legal documents, announcing that they open in a new tab", () => {
    renderWithIntl(<SignUpForm />);
    expect(screen.getByRole("link", { name: /Terms of Service \(opens in a new tab\)/ })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: /Privacy Policy \(opens in a new tab\)/ })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("lets the person reveal what they typed", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("LogInForm", () => {
  async function logIn(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Email"), "amina@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
  }

  it("says plainly when the email and password don't match", async () => {
    const user = userEvent.setup();
    actions.signIn.mockResolvedValue({ data: { status: "invalid_credentials" } });
    renderWithIntl(<LogInForm />);
    await logIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match.");
  });

  it("tells an unverified person a new link was sent", async () => {
    const user = userEvent.setup();
    actions.signIn.mockResolvedValue({ data: { status: "verify_email" } });
    renderWithIntl(<LogInForm />);
    await logIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("We just sent a new link to amina@example.com.");
  });

  it("translates server error codes instead of showing raw text", async () => {
    const user = userEvent.setup();
    actions.signIn.mockResolvedValue({ serverError: "rate_limited" });
    renderWithIntl(<LogInForm />, { locale: "fr" });
    await user.type(screen.getByLabelText("E-mail"), "amina@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "pw");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Beaucoup d'actions d'un coup.");
  });

  it("passes the destination along for the server to validate", async () => {
    const user = userEvent.setup();
    actions.signIn.mockResolvedValue({ data: { status: "invalid_credentials" } });
    renderWithIntl(<LogInForm next="/settings/security" />);
    await logIn(user);
    expect(actions.signIn).toHaveBeenCalledWith(expect.objectContaining({ next: "/settings/security" }));
  });
});

describe("RequestLinkForm", () => {
  it("never reveals whether an account exists", async () => {
    const user = userEvent.setup();
    actions.requestPasswordReset.mockResolvedValue({ data: { status: "sent" } });
    renderWithIntl(<RequestLinkForm purpose="reset" />);
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account uses nobody@example.com");
  });
});
