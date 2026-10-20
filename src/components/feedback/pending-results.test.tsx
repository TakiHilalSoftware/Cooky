import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const nav = vi.hoisted(() => ({ pathname: "/test/list", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const { PendingResults, PendingScope } = await import("./pending-results");

beforeEach(() => {
  nav.pathname = "/test/list";
  nav.search = "";
  window.history.replaceState(null, "", "/test/list");
});

/** Where the links go: the same page with new filters, the same filters, another page. */
const TO = { lemon: "/test/list?with=lemon", same: "/test/list", elsewhere: "/test/other" };

/** A filtered page in miniature: links and a GET form that only change the query, and other links. */
function FilteredPage() {
  // The router handles navigation in the app; here the browser must not try to.
  const stay = (event: { preventDefault: () => void }) => event.preventDefault();
  return (
    <PendingScope>
      <a href={TO.lemon} onClick={stay}>
        Lemon
      </a>
      <a href={TO.same} onClick={stay}>
        Same filters
      </a>
      <a href={TO.elsewhere} onClick={stay}>
        My kitchen
      </a>
      <form action="/test/list" method="get" onSubmit={stay}>
        <input aria-label="Extra" name="with" defaultValue="mint" />
        <button type="submit">Try it</button>
      </form>
      <PendingResults>
        <p>Omelette</p>
      </PendingResults>
    </PendingScope>
  );
}

const results = () => screen.getByText("Omelette").parentElement!.parentElement!;

describe("PendingScope", () => {
  it("dims the results and says they're updating until the new filters arrive", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithIntl(<FilteredPage />);
    expect(results()).not.toHaveAttribute("aria-busy");

    await user.click(screen.getByRole("link", { name: "Lemon" }));
    expect(results()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Updating results…");

    nav.search = "with=lemon";
    rerender(<FilteredPage />);
    expect(results()).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("does the same for a filter form", async () => {
    const user = userEvent.setup();
    renderWithIntl(<FilteredPage />);
    await user.click(screen.getByRole("button", { name: "Try it" }));
    expect(results()).toHaveAttribute("aria-busy", "true");
  });

  it("ignores links that leave the page, keep the same filters, or open elsewhere", async () => {
    const user = userEvent.setup();
    renderWithIntl(<FilteredPage />);
    await user.click(screen.getByRole("link", { name: "My kitchen" }));
    await user.click(screen.getByRole("link", { name: "Same filters" }));
    fireEvent.click(screen.getByRole("link", { name: "Lemon" }), { ctrlKey: true });
    expect(results()).not.toHaveAttribute("aria-busy");
  });

  it("stops dimming if the server never answers", async () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(<FilteredPage />);
      fireEvent.click(screen.getByRole("link", { name: "Lemon" }));
      expect(results()).toHaveAttribute("aria-busy", "true");
      act(() => vi.advanceTimersByTime(15_000));
      expect(results()).not.toHaveAttribute("aria-busy");
    } finally {
      vi.useRealTimers();
    }
  });
});
