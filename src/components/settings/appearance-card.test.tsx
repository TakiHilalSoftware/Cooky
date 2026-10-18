import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "@/lib/appearance";

import { renderWithIntl } from "../../../tests/setup/render";

const updateAppearance = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/settings", () => ({ updateAppearance }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

const { AppearanceCard } = await import("./appearance-card");

function renderCard() {
  return renderWithIntl(
    <ThemeProvider attribute="class">
      <AppearanceCard initial={DEFAULT_APPEARANCE} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  updateAppearance.mockReset();
  toastError.mockReset();
  document.documentElement.dataset.accent = "default";
  document.documentElement.dataset.textSize = "m";
});

describe("AppearanceCard", () => {
  it("names every accent and shows which is selected", () => {
    renderCard();
    const accents = screen.getByRole("radiogroup", { name: "Accent colour" });
    expect(accents).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Saffron" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio").length).toBe(7 + 3 + 4);
  });

  it("applies a new accent at once and saves just that change", async () => {
    const user = userEvent.setup();
    updateAppearance.mockResolvedValue({ data: undefined });
    renderCard();
    await user.click(screen.getByRole("radio", { name: "Mint" }));
    expect(document.documentElement.dataset.accent).toBe("mint");
    await waitFor(() => expect(updateAppearance).toHaveBeenCalledWith({ accent: "mint" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("undoes the change and explains when saving fails", async () => {
    const user = userEvent.setup();
    updateAppearance.mockResolvedValue({ serverError: "unavailable" });
    renderCard();
    await user.click(screen.getByRole("radio", { name: "Extra large" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(document.documentElement.dataset.textSize).toBe("m");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves between choices with the arrow keys", async () => {
    const user = userEvent.setup();
    updateAppearance.mockResolvedValue({ data: undefined });
    renderCard();
    screen.getByRole("radio", { name: "Saffron" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Peach" })).toHaveFocus();
  });
});
