import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillingStatusDto } from "@/server/features/billing/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ startCheckout: vi.fn(), openBillingPortal: vi.fn() }));
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

const { PlanCard } = await import("./plan-card");

type Status = Omit<BillingStatusDto, "usage">;
const AT = "2026-11-18T12:00:00Z";

function status(overrides: Partial<Status> = {}): Status {
  return {
    plan: "plus",
    source: "paid",
    interval: "month",
    priceCents: 399,
    next: { kind: "renews", at: AT },
    canManageBilling: true,
    trialAvailable: false,
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of [...Object.values(actions), toast.error, toast.info]) fn.mockReset();
});

describe("PlanCard", () => {
  it("Free: says it has no time limit, offers the plans, and mentions an unused trial", () => {
    renderWithIntl(
      <PlanCard
        status={status({
          plan: "free",
          source: "free",
          interval: null,
          priceCents: null,
          next: { kind: "none" },
          canManageBilling: false,
          trialAvailable: true,
        })}
      />,
    );
    expect(screen.getByText("Free", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/Free, with no time limit/)).toBeInTheDocument();
    expect(screen.getByText("Your 7-day free trial is still available.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/pricing");
    // No Stripe customer yet: nothing to manage, so no button that would only fail.
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
  });

  it("paid: the renewal date and price, the billing period, and Manage billing", async () => {
    const user = userEvent.setup();
    actions.openBillingPortal.mockResolvedValue({ serverError: "not_found" });
    renderWithIntl(<PlanCard status={status()} />);
    expect(screen.getByText("Renews on November 18, 2026 for €3.99 a month.")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Billed monthly")).toBeInTheDocument();
    expect(screen.getByText(/Change plan, update your card, download invoices or cancel/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Manage billing" }));
    expect(actions.openBillingPortal).toHaveBeenCalledWith({ locale: "en" });
    expect(toast.error).toHaveBeenCalledWith("There's nothing to manage yet. Pick a plan first.");
  });

  it("trial: when it ends and what it costs afterwards", () => {
    renderWithIntl(<PlanCard status={status({ source: "trial", next: { kind: "trial_converts", at: AT } })} />);
    expect(screen.getByText("Free trial")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your free trial ends on November 18, 2026. After that it's €3.99 a month, unless you cancel before.",
      ),
    ).toBeInTheDocument();
  });

  it("cancelled: until when the plan stays, and Keep my plan instead of a second Stripe button", () => {
    renderWithIntl(
      <PlanCard status={status({ interval: "year", priceCents: 3599, next: { kind: "ends", at: AT } })} />,
    );
    expect(
      screen.getByText(
        "Cancelled. You keep Plus until November 18, 2026, then move to Free. You won't be charged again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep my plan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
  });

  it("failed payment: an alert with the date the plan ends and Update card", async () => {
    const user = userEvent.setup();
    actions.openBillingPortal.mockResolvedValue({ serverError: "unavailable" });
    renderWithIntl(<PlanCard status={status({ next: { kind: "grace", at: AT } })} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Your last payment didn't go through");
    expect(alert).toHaveTextContent("Update your card by November 18, 2026 to keep Plus.");
    await user.click(screen.getByRole("button", { name: "Update card" }));
    expect(actions.openBillingPortal).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
  });

  it("comp: a gift, never a price, with or without an end date", () => {
    const comp = { source: "comp" as const, interval: null, priceCents: null, canManageBilling: false };
    const { unmount } = renderWithIntl(<PlanCard status={status({ ...comp, next: { kind: "ends", at: AT } })} />);
    expect(screen.getByText("Gift from Cooky")).toBeInTheDocument();
    expect(
      screen.getByText("A gift from Cooky until November 18, 2026. Then you move to Free. You won't be charged."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep my plan" })).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<PlanCard status={status({ ...comp, next: { kind: "none" } })} />);
    expect(screen.getByText("A gift from Cooky, with no end date. You won't be charged.")).toBeInTheDocument();
  });

  it("speaks French with French dates and prices", () => {
    renderWithIntl(<PlanCard status={status()} />, { locale: "fr" });
    expect(screen.getByText(/^Se renouvelle le 18 novembre 2026 pour 3,99\s€ par mois\.$/)).toBeInTheDocument();
  });
});
