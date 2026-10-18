import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

import { ThemeToggle } from "./theme-toggle";

function renderToggle(locale: "en" | "fr" = "en") {
  return renderWithIntl(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
    { locale },
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  it("has a translated accessible name", () => {
    renderToggle("fr");
    expect(screen.getByRole("button", { name: "Changer de thème" })).toBeInTheDocument();
  });

  it("offers light, dark and device themes, with the device one selected by default", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: "Change theme" }));

    const options = await screen.findAllByRole("menuitemradio");
    expect(options.map((o) => o.textContent)).toEqual(["Light", "Dark", "Match my device"]);
    expect(screen.getByRole("menuitemradio", { name: "Match my device" })).toHaveAttribute("aria-checked", "true");
  });

  it("switches to dark mode with the keyboard alone", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  });
});
