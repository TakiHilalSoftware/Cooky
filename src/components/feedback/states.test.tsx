import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { renderWithIntl } from "../../../tests/setup/render";

import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { PageSkeleton } from "./page-skeleton";

describe("EmptyState", () => {
  it("shows a heading, one sentence and the next step", () => {
    renderWithIntl(
      <EmptyState
        title="No dishes yet"
        description="Add your first dish or browse Discover."
        action={<Button>Add a dish</Button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "No dishes yet" })).toBeInTheDocument();
    expect(screen.getByText("Add your first dish or browse Discover.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a dish" })).toBeInTheDocument();
  });

  it("can be the page's main heading", () => {
    renderWithIntl(<EmptyState headingLevel={1} title="Not found" description="Gone." action={<span />} />);
    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("offers Try again and calls the retry handler", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithIntl(
      <ErrorState
        title="Something went wrong"
        description="Your data is safe."
        retryLabel="Try again"
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("says what still works when given", () => {
    renderWithIntl(
      <ErrorState
        title="Offline"
        description="We can't reach Cooky."
        retryLabel="Try again"
        onRetry={() => {}}
        stillWorks="Your shopping list still works offline."
      />,
    );
    expect(screen.getByText("Your shopping list still works offline.")).toBeInTheDocument();
  });
});

describe("PageSkeleton", () => {
  it("announces loading to screen readers", () => {
    renderWithIntl(<PageSkeleton label="Loading…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
