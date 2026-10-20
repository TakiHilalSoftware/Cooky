import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const report = vi.hoisted(() => vi.fn());
vi.mock("@/lib/report-error", () => ({ reportClientError: report }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { RouteError } = await import("./route-error");

describe("RouteError", () => {
  it("reports the error, never shows it, and offers a retry and a way on", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const error = new Error('relation "dishes" does not exist');
    renderWithIntl(<RouteError error={error} retry={retry} />);

    expect(report).toHaveBeenCalledWith(error);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong on our side" })).toBeInTheDocument();
    expect(screen.queryByText(/relation/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to My dishes" })).toHaveAttribute("href", "/dishes");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("speaks the person's language", () => {
    renderWithIntl(<RouteError error={null} retry={() => {}} />, { locale: "ar" });
    expect(screen.getByRole("link", { name: "انتقلي إلى أطباقي" })).toBeInTheDocument();
  });
});
