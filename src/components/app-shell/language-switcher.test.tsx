import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/dishes/42",
  useRouter: () => ({ replace }),
}));

const { LanguageSwitcher } = await import("./language-switcher");

beforeEach(() => replace.mockClear());

describe("LanguageSwitcher", () => {
  it("names the current language in its accessible name", () => {
    renderWithIntl(<LanguageSwitcher />, { locale: "fr" });
    expect(screen.getByRole("button", { name: "Langue: Français" })).toBeInTheDocument();
  });

  it("lists every language in its own script and marks the current one", async () => {
    const user = userEvent.setup();
    renderWithIntl(<LanguageSwitcher />, { locale: "ar" });
    await user.click(screen.getByRole("button", { name: "اللغة: العربية" }));

    const options = await screen.findAllByRole("menuitemradio");
    expect(options.map((o) => o.textContent)).toEqual(["English", "Français", "العربية"]);
    expect(screen.getByRole("menuitemradio", { name: "العربية" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "العربية" })).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("menuitemradio", { name: "Français" })).toHaveAttribute("lang", "fr");
  });

  it("switches language and stays on the same page", async () => {
    const user = userEvent.setup();
    renderWithIntl(<LanguageSwitcher />, { locale: "en" });
    await user.click(screen.getByRole("button", { name: "Language: English" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Français" }));

    expect(replace).toHaveBeenCalledWith("/dishes/42", { locale: "fr" });
  });

  it("does nothing when the current language is picked again", async () => {
    const user = userEvent.setup();
    renderWithIntl(<LanguageSwitcher />, { locale: "en" });
    await user.click(screen.getByRole("button", { name: "Language: English" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "English" }));

    expect(replace).not.toHaveBeenCalled();
  });
});
