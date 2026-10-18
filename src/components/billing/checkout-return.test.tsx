import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));

const { CHECKOUT_POLL_ATTEMPTS, CHECKOUT_POLL_MS, CheckoutReturn } = await import("./checkout-return");

const FREE = { plan: "free" as const, source: "free" as const, next: { kind: "none" as const } };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  router.refresh.mockReset();
  router.replace.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("CheckoutReturn", () => {
  it("while the webhook hasn't landed: says it's finishing up and re-reads the server", async () => {
    renderWithIntl(<CheckoutReturn status={FREE} />);
    expect(screen.getByRole("status")).toHaveTextContent("Finishing up…");
    expect(router.refresh).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(CHECKOUT_POLL_MS));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(CHECKOUT_POLL_MS));
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("stops polling after a while, reassures, and lets the person check again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<CheckoutReturn status={FREE} />);
    for (let i = 0; i < CHECKOUT_POLL_ATTEMPTS; i++) await act(() => vi.advanceTimersByTimeAsync(CHECKOUT_POLL_MS));
    expect(router.refresh).toHaveBeenCalledTimes(CHECKOUT_POLL_ATTEMPTS);
    expect(screen.getByRole("status")).toHaveTextContent("This is taking longer than usual");
    expect(screen.getByRole("status")).toHaveTextContent("You don't need to pay again.");

    await act(() => vi.advanceTimersByTimeAsync(CHECKOUT_POLL_MS * 3));
    expect(router.refresh).toHaveBeenCalledTimes(CHECKOUT_POLL_ATTEMPTS);

    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(router.refresh).toHaveBeenCalledTimes(CHECKOUT_POLL_ATTEMPTS + 1);
    expect(screen.getByRole("status")).toHaveTextContent("Finishing up…");
  });

  it("once the plan is in the database: welcomes with the trial end, and stops polling", async () => {
    const { rerender } = renderWithIntl(<CheckoutReturn status={FREE} />);
    rerender(
      <CheckoutReturn
        status={{ plan: "plus", source: "trial", next: { kind: "trial_converts", at: "2026-10-25T12:00:00Z" } }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("You're on Plus");
    expect(screen.getByRole("status")).toHaveTextContent("Your free trial runs until October 25, 2026.");
    await act(() => vi.advanceTimersByTimeAsync(CHECKOUT_POLL_MS * 3));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("paid straight away: thanks, and Dismiss clears the notice from the URL", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(
      <CheckoutReturn status={{ plan: "pro", source: "paid", next: { kind: "renews", at: "2026-11-18T12:00:00Z" } }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Thank you! Everything in Pro is ready to use.");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(router.replace).toHaveBeenCalledWith("/settings/billing", { scroll: false });
  });
});
