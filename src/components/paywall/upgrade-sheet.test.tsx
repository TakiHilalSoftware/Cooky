import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanFeature } from "@/lib/plan-features";
import type { UpgradeOfferDto } from "@/server/features/billing/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({
  getUpgradeOffer: vi.fn(),
  startCheckout: vi.fn(),
  openBillingPortal: vi.fn(),
}));
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

const { UpgradeSheetProvider, useActionErrorHandler, useUpgradeSheet } = await import("./upgrade-sheet-provider");

const PLUS = { month: 399, year: 3599 };
const PRO = { month: 799, year: 6999 };

function offer(overrides: Partial<UpgradeOfferDto> = {}): UpgradeOfferDto {
  return {
    feature: "assistant",
    plan: "free",
    current: { feature: "assistant", limit: 10, period: "month" },
    usage: {
      feature: "assistant",
      limit: 10,
      remaining: 0,
      period: "month",
      resetsAt: "2026-11-01T12:00:00Z",
    },
    options: [
      { plan: "plus", prices: PLUS, limit: { feature: "assistant", limit: 150, period: "month" } },
      { plan: "pro", prices: PRO, limit: { feature: "assistant", limit: 600, period: "month" } },
    ],
    trialAvailable: true,
    subscribed: false,
    ...overrides,
  };
}

/** A pretend feature: its action failed with `code`. */
function Harness({ code, feature = "assistant" }: { code: string; feature?: PlanFeature }) {
  const onError = useActionErrorHandler();
  const open = useUpgradeSheet();
  return (
    <>
      <button type="button" onClick={() => onError(code, feature)}>
        Ask
      </button>
      <button type="button" onClick={() => open({ feature, reason: "more" })}>
        More
      </button>
    </>
  );
}

function renderHarness(code: string, feature?: PlanFeature) {
  return renderWithIntl(
    <UpgradeSheetProvider>
      <Harness code={code} feature={feature} />
    </UpgradeSheetProvider>,
  );
}

beforeEach(() => {
  for (const fn of [...Object.values(actions), toast.error, toast.info]) fn.mockReset();
});

describe("useActionErrorHandler", () => {
  it("opens the upgrade sheet on quota_exceeded, for that feature, instead of a dead-end toast", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({ data: offer() });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    const sheet = await screen.findByRole("dialog", { name: "You've used all 10 questions for this month" });
    expect(actions.getUpgradeOffer).toHaveBeenCalledWith({ feature: "assistant" });
    expect(within(sheet).getByText("Your tries come back on November 1, 2026.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("opens it on plan_required too", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({
      data: offer({
        feature: "household_list",
        current: { feature: "household_list", limit: 0, period: "none" },
        usage: null,
        options: [
          { plan: "plus", prices: PLUS, limit: { feature: "household_list", limit: 0, period: "none" } },
          { plan: "pro", prices: PRO, limit: { feature: "household_list", limit: null, period: "none" } },
        ],
      }),
    });
    renderHarness("plan_required", "household_list");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByRole("dialog", { name: "Shared household list is part of Plus" })).toBeInTheDocument();
  });

  it("any other error is a translated toast, never raw text, and no sheet", async () => {
    const user = userEvent.setup();
    renderHarness("rate_limited");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(toast.error).toHaveBeenCalledWith("That was a lot at once. Wait a moment, then try again.");
    expect(actions.getUpgradeOffer).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("UpgradeSheet", () => {
  it("offers each higher plan with this feature's allowance and price, and starts the trial checkout", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({ data: offer() });
    actions.startCheckout.mockResolvedValue({ serverError: "unavailable" });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const sheet = await screen.findByRole("dialog");

    const plans = within(within(sheet).getByRole("list", { name: "Plans with more" })).getAllByRole("listitem");
    expect(plans).toHaveLength(2);
    expect(plans[0]).toHaveTextContent("Plus");
    expect(plans[0]).toHaveTextContent("€3.99 a month");
    expect(plans[0]).toHaveTextContent("150 questions a month");
    expect(plans[0]).toHaveTextContent("Free for 7 days, then €3.99 a month. Cancel anytime.");
    expect(plans[1]).toHaveTextContent("600 questions a month");

    await user.click(within(plans[1]!).getByRole("button", { name: "Start 7-day free trial: Pro" }));
    expect(actions.startCheckout).toHaveBeenCalledWith({ plan: "pro", interval: "month", locale: "en" });
    // A failed checkout says why and leaves the sheet usable.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This isn't available right now. Try again in a moment."),
    );
    expect(within(plans[1]!).getByRole("button", { name: "Start 7-day free trial: Pro" })).toBeEnabled();
  });

  it("after the trial is used, it says Upgrade, without a trial note", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({ data: offer({ trialAvailable: false }) });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "Upgrade to Plus" })).toBeInTheDocument();
    expect(within(sheet).queryByText(/Free for 7 days/)).not.toBeInTheDocument();
  });

  it("people already paying switch in the billing portal", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({
      data: offer({ plan: "plus", subscribed: true, trialAvailable: false, options: offer().options.slice(1) }),
    });
    actions.openBillingPortal.mockResolvedValue({ serverError: "unavailable" });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.click(await screen.findByRole("button", { name: "Switch to Pro" }));
    expect(actions.openBillingPortal).toHaveBeenCalledWith({ locale: "en" });
    expect(actions.startCheckout).not.toHaveBeenCalled();
  });

  it("on the top plan it explains the reset instead of selling, and still closes in one tap", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({ data: offer({ plan: "pro", options: [] }) });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("You're on Pro, our biggest plan.")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opened for more (not out yet), it asks rather than claiming they ran out", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({ data: offer({ usage: { ...offer().usage!, remaining: 2 } }) });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(await screen.findByRole("dialog", { name: "Need more than 10 questions a month?" })).toBeInTheDocument();
  });

  it("a counted limit says what was reached and that nothing is lost", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({
      data: offer({
        feature: "dishes",
        current: { feature: "dishes", limit: 50, period: "none" },
        usage: null,
        options: [{ plan: "plus", prices: PLUS, limit: { feature: "dishes", limit: 500, period: "none" } }],
      }),
    });
    renderHarness("quota_exceeded", "dishes");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const sheet = await screen.findByRole("dialog", { name: "You've reached 50 dishes" });
    expect(within(sheet).getByText(/That's the most Free holds/)).toBeInTheDocument();
    expect(within(sheet).getByText("Up to 500 dishes")).toBeInTheDocument();
  });

  it("never dead-ends: Not now, Compare all plans and Close are always there", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer.mockResolvedValue({ data: offer() });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("link", { name: "Compare all plans" })).toHaveAttribute("href", "/pricing");
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("if the offer can't load, it says so and Try again reloads it", async () => {
    const user = userEvent.setup();
    actions.getUpgradeOffer
      .mockResolvedValueOnce({ serverError: "unavailable" })
      .mockResolvedValueOnce({ data: offer() });
    renderHarness("quota_exceeded");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const sheet = await screen.findByRole("dialog", { name: "We couldn't load your options" });
    expect(within(sheet).getByRole("link", { name: "Compare all plans" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("dialog", { name: "You've used all 10 questions for this month" }),
    ).toBeInTheDocument();
    expect(actions.getUpgradeOffer).toHaveBeenCalledTimes(2);
  });
});
