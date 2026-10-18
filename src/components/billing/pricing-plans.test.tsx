import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PricingDto, PricingViewerDto } from "@/server/features/billing/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ startCheckout: vi.fn(), openBillingPortal: vi.fn(), getUpgradeOffer: vi.fn() }));
vi.mock("@/server/actions/billing", () => actions);
const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { PricingPlans } = await import("./pricing-plans");

function pricing(viewer: PricingViewerDto): PricingDto {
  return {
    viewer,
    plans: [
      {
        plan: "free",
        prices: null,
        yearlySavingsPercent: null,
        limits: [
          { feature: "assistant", limit: 10, period: "month" },
          { feature: "dishes", limit: 50, period: "none" },
          { feature: "household_list", limit: 0, period: "none" },
        ],
      },
      {
        plan: "plus",
        prices: { month: 399, year: 3599 },
        yearlySavingsPercent: 24,
        limits: [
          { feature: "assistant", limit: 150, period: "month" },
          { feature: "dishes", limit: 500, period: "none" },
          { feature: "household_list", limit: 0, period: "none" },
        ],
      },
      {
        plan: "pro",
        prices: { month: 799, year: 6999 },
        yearlySavingsPercent: 27,
        limits: [
          { feature: "assistant", limit: 600, period: "month" },
          { feature: "spins", limit: null, period: "day" },
          { feature: "household_list", limit: null, period: "none" },
        ],
      },
    ],
  };
}

const signedIn = (overrides: Partial<Extract<PricingViewerDto, { signedIn: true }>> = {}): PricingViewerDto => ({
  signedIn: true,
  plan: "free",
  source: "free",
  subscribed: false,
  trialAvailable: true,
  ...overrides,
});

const card = (name: string) => screen.getByRole("listitem", { name });

beforeEach(() => {
  for (const fn of [...Object.values(actions), toast.error, toast.info]) fn.mockReset();
});

describe("PricingPlans", () => {
  it("renders limits from the server in words, and gated features as included or not", () => {
    renderWithIntl(<PricingPlans pricing={pricing({ signedIn: false })} />);
    expect(within(card("Free")).getByText("10 questions a month")).toBeInTheDocument();
    expect(within(card("Free")).getByText("Up to 50 dishes")).toBeInTheDocument();
    expect(within(card("Pro")).getByText("Unlimited")).toBeInTheDocument();
    expect(within(card("Plus")).getByText(/Shared household list/)).toHaveTextContent("Not included");
    expect(within(card("Pro")).getByText(/Shared household list/)).toHaveTextContent("Included");
  });

  it("switches between monthly and yearly prices, with the honest saving", async () => {
    const user = userEvent.setup();
    renderWithIntl(<PricingPlans pricing={pricing({ signedIn: false })} />);
    expect(within(card("Plus")).getByText("€3.99")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Yearly/ })).toHaveTextContent("Save up to 27%");

    await user.click(screen.getByRole("radio", { name: /Yearly/ }));
    expect(within(card("Plus")).getByText("€35.99")).toBeInTheDocument();
    expect(within(card("Plus")).getByText("About €3 a month, 24% less than paying monthly.")).toBeInTheDocument();
    expect(within(card("Free")).getByText("€0")).toBeInTheDocument();

    // Clicking the active option again keeps it, rather than leaving no period selected.
    await user.click(screen.getByRole("radio", { name: /Yearly/ }));
    expect(screen.getByRole("radio", { name: /Yearly/ })).toBeChecked();
  });

  it("signed out: every plan leads to sign-up, paid ones as a trial", () => {
    renderWithIntl(<PricingPlans pricing={pricing({ signedIn: false })} />);
    expect(within(card("Free")).getByRole("link", { name: "Sign up free" })).toHaveAttribute("href", "/signup");
    expect(within(card("Plus")).getByRole("link", { name: "Start 7-day free trial" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(within(card("Plus")).getByText(/Free for 7 days, then €3.99 a month/)).toBeInTheDocument();
    expect(actions.startCheckout).not.toHaveBeenCalled();
  });

  it("on Free with the trial unused: checkout for the chosen plan and period", async () => {
    const user = userEvent.setup();
    actions.startCheckout.mockResolvedValue({ serverError: "unavailable" });
    renderWithIntl(<PricingPlans pricing={pricing(signedIn())} />);
    expect(within(card("Free")).getByText("Your plan")).toBeInTheDocument();
    expect(within(card("Free")).getByText("You're on Free. No card needed.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Yearly/ }));
    await user.click(within(card("Pro")).getByRole("button", { name: "Start 7-day free trial: Pro" }));
    expect(actions.startCheckout).toHaveBeenCalledWith({ plan: "pro", interval: "year", locale: "en" });
    expect(await screen.findByRole("button", { name: "Start 7-day free trial: Pro" })).toBeEnabled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("with the trial used, it never promises a trial", () => {
    renderWithIntl(<PricingPlans pricing={pricing(signedIn({ trialAvailable: false }))} />);
    expect(within(card("Plus")).getByRole("button", { name: "Upgrade to Plus" })).toBeInTheDocument();
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
  });

  it("subscribers change or cancel in the portal, never through a second checkout", async () => {
    const user = userEvent.setup();
    actions.openBillingPortal.mockResolvedValue({ serverError: "unavailable" });
    renderWithIntl(<PricingPlans pricing={pricing(signedIn({ plan: "plus", source: "paid", subscribed: true }))} />);
    expect(within(card("Plus")).getByRole("button", { name: "Manage plan: Plus" })).toBeInTheDocument();
    expect(within(card("Plus")).getByText(/Stripe's secure billing page/)).toBeInTheDocument();
    expect(within(card("Free")).getByRole("button", { name: "Switch to Free" })).toBeInTheDocument();

    await user.click(within(card("Pro")).getByRole("button", { name: "Switch to Pro" }));
    expect(actions.openBillingPortal).toHaveBeenCalledWith({ locale: "en" });
    expect(actions.startCheckout).not.toHaveBeenCalled();
  });

  it("a gifted plan isn't for sale, and lower plans offer nothing to buy", () => {
    renderWithIntl(
      <PricingPlans pricing={pricing(signedIn({ plan: "pro", source: "comp", trialAvailable: false }))} />,
    );
    expect(
      within(card("Pro")).getByText("You have Pro as a gift from Cooky, so you won't be charged."),
    ).toBeInTheDocument();
    expect(within(card("Pro")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(card("Plus")).queryByRole("button")).not.toBeInTheDocument();
  });
});
