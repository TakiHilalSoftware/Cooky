import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UsageDto } from "@/server/features/billing/dto";

import { renderWithIntl } from "../../../tests/setup/render";

import { isLow, TriesMeter } from "./tries-meter";

const usage = (overrides: Partial<UsageDto> = {}): UsageDto => ({
  feature: "assistant",
  limit: 10,
  remaining: 7,
  period: "month",
  resetsAt: "2026-11-01T12:00:00Z",
  ...overrides,
});

describe("isLow", () => {
  it("is low at 3 or fewer once some were spent", () => {
    expect(isLow({ limit: 10, remaining: 3 })).toBe(true);
    expect(isLow({ limit: 10, remaining: 4 })).toBe(false);
  });

  it("an untouched small allowance (3 of 3 spins) isn't low", () => {
    expect(isLow({ limit: 3, remaining: 3 })).toBe(false);
    expect(isLow({ limit: 3, remaining: 2 })).toBe(true);
  });

  it("unlimited is never low", () => {
    expect(isLow({ limit: null, remaining: null })).toBe(false);
  });
});

describe("TriesMeter", () => {
  it("shows what's left from server values, as a labelled meter, with the reset date", () => {
    renderWithIntl(<TriesMeter usage={usage()} />);
    expect(screen.getByText("7 of 10 left")).toBeInTheDocument();
    const meter = screen.getByRole("progressbar", { name: "AI Assistant tries" });
    expect(meter).toHaveAttribute("aria-valuetext", "7 of 10 left");
    expect(screen.getByText(/^Resets on Nov 1, 2026$/)).toBeInTheDocument();
    expect(screen.getByText(/Each question uses one try/)).toBeInTheDocument();
  });

  it("says when nothing is left, and still says when it comes back", () => {
    renderWithIntl(<TriesMeter usage={usage({ remaining: 0 })} />);
    expect(screen.getByText("None left")).toBeInTheDocument();
    expect(screen.getByText(/Resets on/)).toBeInTheDocument();
  });

  it("unlimited has no bar and no reset date to worry about", () => {
    renderWithIntl(<TriesMeter usage={usage({ feature: "spins", limit: null, remaining: null, period: "day" })} />);
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/Resets/)).not.toBeInTheDocument();
  });

  it("daily allowances reset in relative time", () => {
    const soon = new Date(Date.now() + 5 * 60 * 60 * 1000 + 60_000).toISOString();
    renderWithIntl(
      <TriesMeter usage={usage({ feature: "spins", limit: 3, remaining: 1, period: "day", resetsAt: soon })} />,
    );
    expect(screen.getByText("Resets in 5 hours")).toBeInTheDocument();
  });

  it("renders the action it is given (e.g. Get more)", () => {
    renderWithIntl(<TriesMeter usage={usage({ remaining: 1 })} action={<button type="button">Get more</button>} />);
    expect(screen.getByRole("button", { name: "Get more" })).toBeInTheDocument();
  });

  describe("compact", () => {
    it("stays low-key above 3 left (PRD §3.10)", () => {
      renderWithIntl(<TriesMeter variant="compact" usage={usage({ remaining: 7 })} />);
      expect(screen.getByText("7 tries left")).toHaveAttribute("data-level", "ok");
    });

    it("stands out at 3 or fewer", () => {
      renderWithIntl(<TriesMeter variant="compact" usage={usage({ remaining: 1 })} />);
      expect(screen.getByText("1 try left")).toHaveAttribute("data-level", "low");
    });

    it("says plainly when none are left", () => {
      renderWithIntl(<TriesMeter variant="compact" usage={usage({ remaining: 0 })} />);
      expect(screen.getByText("No tries left")).toHaveAttribute("data-level", "empty");
    });

    it("shows nothing when unlimited", () => {
      const { container } = renderWithIntl(
        <TriesMeter variant="compact" usage={usage({ limit: null, remaining: null })} />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("uses Arabic plural forms", () => {
    renderWithIntl(<TriesMeter variant="compact" usage={usage({ remaining: 2 })} />, { locale: "ar" });
    expect(screen.getByText("تبقّت محاولتان")).toBeInTheDocument();
  });
});
