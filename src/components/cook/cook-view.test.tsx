import { screen } from "@testing-library/react";
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
