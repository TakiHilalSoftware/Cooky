import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const startSocialSignIn = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/auth", () => ({ startSocialSignIn, passkeyLogin: vi.fn(), passkeyLoginOptions: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const { SignInAlternatives } = await import("./sign-in-alternatives");

const assign = vi.fn();
beforeEach(() => {
  startSocialSignIn.mockReset();
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => vi.unstubAllGlobals());

describe("SignInAlternatives", () => {
  it("offers only the providers the server configured", () => {
    renderWithIntl(<SignInAlternatives providers={["google"]} />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();
  });

  it("renders nothing at all when there is no alternative to offer", () => {
    const { container } = renderWithIntl(<SignInAlternatives providers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sends the browser to the provider's page", async () => {
    const user = userEvent.setup();
    startSocialSignIn.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth?state=x" } });
    renderWithIntl(<SignInAlternatives providers={["google"]} next="/settings/security" />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth?state=x"));
    expect(startSocialSignIn).toHaveBeenCalledWith({ provider: "google", next: "/settings/security", locale: "en" });
  });

  it("explains a failure and lets the person try again", async () => {
    const user = userEvent.setup();
    startSocialSignIn.mockResolvedValue({ serverError: "unavailable" });
    renderWithIntl(<SignInAlternatives providers={["google"]} />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Signing in with Google or Apple didn't work.");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it("states the terms on sign-up", () => {
    renderWithIntl(<SignInAlternatives providers={["google"]} withConsent />);
    expect(screen.getByText(/By continuing with Google or Apple, you agree/)).toBeInTheDocument();
  });
});
