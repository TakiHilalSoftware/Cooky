import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CookDto } from "@/server/features/cook/dto";

import { renderWithIntl } from "../../../tests/setup/render";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/cook", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/form", () => ({ default: ({ children }: { children: ReactNode }) => <form>{children}</form> }));
vi.mock("@/server/actions/cook", () => ({ logCook: vi.fn(), undoLogCook: vi.fn() }));

const { CookView } = await import("./cook-view");

const WINTER = { id: "11111111-1111-4111-8111-111111111111", name: "Winter", dishCount: 0 };
const base: CookDto = {
  dishes: [],
  total: 3,
  have: [],
  extras: [],
  collections: [WINTER],
  collection: null,
  weather: null,
  season: "winter",
  meal: null,
};

describe("CookView collections", () => {
  it("offers the person's collections as chips that keep the what-if", () => {
    renderWithIntl(<CookView cook={{ ...base, extras: ["lemons"] }} locale="en" />);
    const nav = screen.getByRole("navigation", { name: "Choose from a collection" });
    expect(screen.getByRole("link", { name: "All dishes" })).toHaveAttribute("aria-current", "page");
    const chip = screen.getByRole("link", { name: /Winter/ });
    expect(nav).toContainElement(chip);
    expect(JSON.parse(chip.getAttribute("href")!)).toEqual({
      pathname: "/cook",
      query: { with: ["lemons"], without: [], collection: WINTER.id },
    });
  });

  it("an empty collection says so and offers a way back to all dishes", () => {
    renderWithIntl(<CookView cook={{ ...base, collection: WINTER.id }} locale="en" />);
    expect(screen.getByRole("link", { name: /Winter/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "This collection is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all dishes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the collection" })).toHaveAttribute(
      "href",
      `/dishes?collection=${WINTER.id}`,
    );
  });

  it("without collections, shows no chip row", () => {
    renderWithIntl(<CookView cook={{ ...base, collections: [] }} locale="en" />);
    expect(screen.queryByRole("navigation", { name: "Choose from a collection" })).not.toBeInTheDocument();
  });
});

const card = (id: string, name: string, overrides: Partial<CookDto["dishes"][number]> = {}) => ({
  id,
  name,
  course: "main" as const,
  photoUrl: null,
  missing: [],
  weatherFit: false,
  dietFit: true,
  daysSinceCooked: null,
  planned: false,
  usualCount: 0,
  ...overrides,
});
const LUNCH: NonNullable<CookDto["meal"]> = {
  slot: "lunch",
  at: 750,
  when: "later",
  inMinutes: 150,
  picked: false,
  day: [
    { slot: "lunch", at: 750, passed: false },
    { slot: "dinner", at: 1170, passed: false },
  ],
  now: 600,
  plannedCount: 1,
  usualCount: 0,
  logAs: "lunch",
};

describe("CookView for a meal", () => {
  const dishes = [card("d1", "Tagine", { planned: true }), card("d2", "Shakshuka"), card("d3", "Harira")];

  it("features the best match as the meal's top pick, and doesn't repeat it in the list", () => {
    renderWithIntl(<CookView cook={{ ...base, dishes, meal: LUNCH }} locale="en" />);
    const pick = screen.getByRole("region", { name: "Top pick for lunch" });
    expect(within(pick).getByRole("heading", { name: "Tagine" })).toBeInTheDocument();
    expect(within(pick).getByText("Top pick for lunch")).toBeInTheDocument();
    expect(within(pick).getByText("Planned for lunch")).toBeInTheDocument();
    const list = within(screen.getByRole("region", { name: "Dishes, best match first" })).getAllByRole("heading");
    expect(list.map((h) => h.textContent)).toEqual(["Shakshuka", "Harira"]);
  });

  it("each meal on the rail keeps the what-if, and the next meal clears ?meal=", () => {
    renderWithIntl(<CookView cook={{ ...base, dishes, extras: ["lemons"], meal: LUNCH }} locale="en" />);
    const rail = screen.getByRole("navigation", { name: "Your meals today" });
    const [lunch, dinner] = within(rail).getAllByRole("link");
    expect(JSON.parse(dinner!.getAttribute("href")!)).toEqual({
      pathname: "/cook",
      query: { with: ["lemons"], without: [], meal: "dinner" },
    });
    expect(JSON.parse(lunch!.getAttribute("href")!)).toEqual({
      pathname: "/cook",
      query: { with: ["lemons"], without: [] },
    });
  });

  it("without a meal (every meal off), there's no rail and no pick: the list is whole", () => {
    renderWithIntl(<CookView cook={{ ...base, dishes }} locale="en" />);
    expect(screen.queryByRole("navigation", { name: "Your meals today" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Top pick/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toContain("Tagine");
  });
});
