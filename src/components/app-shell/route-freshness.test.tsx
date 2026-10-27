import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Skeleton } from "@/components/ui/skeleton";

import { renderWithIntl } from "../../../tests/setup/render";

const nav = vi.hoisted(() => ({ pathname: "/kitchen", refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: nav.refresh }),
}));

const { FreshnessRegion } = await import("./route-freshness");

let now = 1_000_000;
// The refresh stays in flight until the test lets it land, like a slow server.
let land: () => void = () => {};

beforeEach(() => {
  nav.pathname = "/kitchen";
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  nav.refresh.mockImplementation(() => new Promise<void>((resolve) => (land = resolve)));
});

afterEach(() => nav.refresh.mockReset());

function page(content = <p>Pantry</p>) {
  return <FreshnessRegion>{content}</FreshnessRegion>;
}

/** Renders the first page, goes elsewhere, then comes back by a link after `minutes`, showing `arriving`. */
async function returnAfter(minutes: number, arriving = <p>Pantry</p>) {
  const view = renderWithIntl(page());
  nav.pathname = "/dishes";
  view.rerender(page());
  now += minutes * 60_000;
  nav.pathname = "/kitchen";
  await act(async () => view.rerender(page(arriving)));
  return view;
}

const main = () => screen.getByRole("main");
const content = () => screen.getByText("Pantry").parentElement;

describe("FreshnessRegion", () => {
  it("leaves a first visit alone: nothing dimmed, nothing refreshed", () => {
    renderWithIntl(page());
    expect(main()).not.toHaveAttribute("aria-busy");
    expect(content()).not.toHaveClass("opacity-60");
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("shows a page kept from the last minute as is", async () => {
    await returnAfter(0.5);
    expect(nav.refresh).not.toHaveBeenCalled();
    expect(main()).not.toHaveAttribute("aria-busy");
  });

  it("shows an older kept page dimmed and busy while it refreshes, then brings it back", async () => {
    await returnAfter(5);
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    expect(main()).toHaveAttribute("aria-busy", "true");
    expect(content()).toHaveClass("opacity-60");
    expect(screen.getByText("Refreshing…")).toBeInTheDocument();
    // Still the old page meanwhile, not a skeleton.
    expect(screen.getByText("Pantry")).toBeInTheDocument();

    await act(async () => land());
    expect(main()).not.toHaveAttribute("aria-busy");
    expect(content()).not.toHaveClass("opacity-60");
    expect(screen.queryByText("Refreshing…")).not.toBeInTheDocument();
  });

  it("doesn't refresh or dim a page arriving under its skeleton: it is already being fetched anew", async () => {
    await returnAfter(5, <Skeleton className="h-10" />);
    expect(nav.refresh).not.toHaveBeenCalled();
    expect(main()).not.toHaveAttribute("aria-busy");
  });
});
