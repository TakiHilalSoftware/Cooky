import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CookMealDto } from "@/server/features/cook/dto";

import { renderWithIntl } from "../../../tests/setup/render";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

const { DayRail, railOffset } = await import("./day-rail");

const DAY = [
  { slot: "breakfast" as const, at: 480, passed: true },
  { slot: "lunch" as const, at: 750, passed: false },
  { slot: "snack" as const, at: 990, passed: false },
  { slot: "dinner" as const, at: 1170, passed: false },
];
// 10:00, lunch at 12:30 next.
const LUNCH: CookMealDto = {
  slot: "lunch",
  at: 750,
  when: "later",
  inMinutes: 150,
  picked: false,
  day: DAY,
  now: 600,
  plannedCount: 0,
  usualCount: 0,
  logAs: "lunch",
};
const hrefFor = (slot: string | null) => (slot ? `/cook?meal=${slot}` : "/cook");

describe("railOffset", () => {
  const stops = DAY.map((d) => d.at);

  it("puts 'now' exactly on a meal at its time (stops are column centres)", () => {
    expect(railOffset(480, stops)).toBe(12.5);
    expect(railOffset(1170, stops)).toBe(87.5);
  });

  it("moves proportionally between the two meals around it", () => {
    // Halfway from breakfast (08:00) to lunch (12:30) is 10:15: halfway from 12.5% to 37.5%.
    expect(railOffset(615, stops)).toBe(25);
  });

  it("starts at midnight on one end and ends at midnight on the other", () => {
    expect(railOffset(0, stops)).toBe(0);
    expect(railOffset(240, stops)).toBeCloseTo(6.25);
    expect(railOffset(1439, stops)).toBeLessThan(100);
  });

  it("works with a single meal", () => {
    expect(railOffset(1200, [1200])).toBe(50);
  });
});

describe("DayRail", () => {
  it("names the meal, its time and how long until it", () => {
    renderWithIntl(<DayRail meal={LUNCH} hrefFor={hrefFor} />);
    expect(screen.getByRole("heading", { level: 2, name: "Lunch at 12:30 PM" })).toBeInTheDocument();
    expect(screen.getByText("In 2 hr 30 min")).toBeInTheDocument();
    // Nothing planned and no history yet: what's makeable leads, and it says how the ranking learns.
    expect(
      screen.getByText(
        "What you can make now comes first. Log what you cook for this meal, and Cook learns what you like then.",
      ),
    ).toBeInTheDocument();
  });

  it("lists the day's meals as links, the shown one marked current", () => {
    renderWithIntl(<DayRail meal={LUNCH} hrefFor={hrefFor} />);
    const nav = screen.getByRole("navigation", { name: "Your meals today" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((a) => a.textContent)).toEqual([
      "Breakfast8:00 AM",
      "Lunch12:30 PM",
      "Snack4:30 PM",
      "Dinner7:30 PM",
    ]);
    expect(links[1]).toHaveAttribute("aria-current", "true");
    expect(links[2]).toHaveAttribute("href", "/cook?meal=snack");
    // A meal already over today says it shows tomorrow's.
    expect(links[0]).toHaveAttribute("title", "Already over today: shows dishes for tomorrow's breakfast");
  });

  it("says what's planned comes first, and offers the way back after picking another meal", () => {
    renderWithIntl(
      <DayRail
        meal={{ ...LUNCH, slot: "dinner", at: 1170, picked: true, plannedCount: 1, usualCount: 2 }}
        hrefFor={hrefFor}
      />,
    );
    expect(screen.getByText(/1 dish is planned for it and comes first\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Then what you can make now, with what you often have at this meal moved up\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your next meal" })).toHaveAttribute("href", "/cook");
  });

  it("speaks of now and of tomorrow plainly", () => {
    const { unmount } = renderWithIntl(
      <DayRail meal={{ ...LUNCH, when: "now", inMinutes: 0, now: 760 }} hrefFor={hrefFor} />,
    );
    expect(screen.getByRole("heading", { name: "Lunch, right now" })).toBeInTheDocument();
    expect(screen.getByText("Started at 12:30 PM")).toBeInTheDocument();
    unmount();
    renderWithIntl(
      <DayRail
        meal={{ ...LUNCH, slot: "breakfast", at: 480, when: "tomorrow", inMinutes: 600, now: 1320, logAs: null }}
        hrefFor={hrefFor}
      />,
    );
    expect(screen.getByRole("heading", { name: "Breakfast tomorrow at 8:00 AM" })).toBeInTheDocument();
    expect(screen.getByText("In 10 hr")).toBeInTheDocument();
  });

  it("links to the meal times in Settings, explained", () => {
    renderWithIntl(<DayRail meal={LUNCH} hrefFor={hrefFor} />);
    const link = screen.getByRole("link", { name: "Meal times" });
    expect(link).toHaveAttribute("href", "/settings#meal-times");
    expect(link).toHaveAttribute("title", "Change when you usually eat");
  });

  it("reads right to left in Arabic, in Arabic", () => {
    renderWithIntl(<DayRail meal={LUNCH} hrefFor={hrefFor} />, { locale: "ar" });
    expect(screen.getByRole("navigation", { name: "وجباتكِ اليوم" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("الغداء");
  });
});
