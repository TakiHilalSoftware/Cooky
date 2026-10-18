import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientSuggestionDto } from "@/server/features/ingredients/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ suggestIngredients: vi.fn() }));
vi.mock("@/server/actions/ingredients", () => actions);

const { IngredientNameField } = await import("./ingredient-name-field");

const TOMATO: IngredientSuggestionDto = { name: "Tomato", defaultUnit: "piece", source: "dictionary" };
const PASTE: IngredientSuggestionDto = { name: "Tomato paste", defaultUnit: "tbsp", source: "dictionary" };
const MINE: IngredientSuggestionDto = { name: "Grandma's spice mix", defaultUnit: null, source: "yours" };

function Field({ onPick }: { onPick?: (s: IngredientSuggestionDto) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <label htmlFor="ingredient">Ingredient</label>
      <IngredientNameField id="ingredient" value={value} onChange={setValue} onPick={onPick} />
      <input aria-label="Note" />
    </>
  );
}

beforeEach(() => actions.suggestIngredients.mockReset());

describe("IngredientNameField", () => {
  it("is a labelled combobox that asks the server as you type, in your language", async () => {
    const user = userEvent.setup();
    actions.suggestIngredients.mockResolvedValue({ data: [TOMATO, PASTE] });
    renderWithIntl(<Field />, { locale: "fr" });
    await user.type(screen.getByRole("combobox", { name: "Ingredient" }), "toma");
    expect(await screen.findByRole("option", { name: "Tomato" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
    // Debounced: one request for the whole word, not one per letter.
    expect(actions.suggestIngredients).toHaveBeenCalledTimes(1);
    expect(actions.suggestIngredients).toHaveBeenCalledWith({ query: "toma", locale: "fr" });
  });

  it("Tab accepts a suggestion that starts with what was typed, gives its unit, and moves on", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    actions.suggestIngredients.mockResolvedValue({ data: [TOMATO, PASTE] });
    renderWithIntl(<Field onPick={onPick} />);
    await user.type(screen.getByRole("combobox"), "toma");
    await screen.findByRole("option", { name: "Tomato" });
    expect(screen.getByRole("option", { name: "Tomato" })).toHaveAttribute("aria-selected", "true");
    await user.tab();
    expect(screen.getByRole("combobox")).toHaveValue("Tomato");
    expect(onPick).toHaveBeenCalledWith(TOMATO);
    expect(screen.getByLabelText("Note")).toHaveFocus();
  });

  it("arrows choose, Enter picks without submitting the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault());
    actions.suggestIngredients.mockResolvedValue({ data: [TOMATO, PASTE] });
    renderWithIntl(
      <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
        <Field />
      </form>,
    );
    await user.type(screen.getByRole("combobox"), "toma");
    await screen.findByRole("option", { name: "Tomato" });
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Tomato paste" }).id,
    );
    await user.keyboard("{Enter}");
    expect(screen.getByRole("combobox")).toHaveValue("Tomato paste");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox", { hidden: true })).not.toBeVisible();
  });

  it("never replaces your own words: nothing is highlighted unless it starts with what you typed", async () => {
    const user = userEvent.setup();
    actions.suggestIngredients.mockResolvedValue({ data: [TOMATO] });
    renderWithIntl(<Field />);
    // e.g. a regional word that maps to a staple with another name
    await user.type(screen.getByRole("combobox"), "bandora");
    await screen.findByRole("option", { name: "Tomato" });
    expect(screen.getByRole("option", { name: "Tomato" })).toHaveAttribute("aria-selected", "false");
    await user.tab();
    expect(screen.getByLabelText("Ingredient")).toHaveValue("bandora");
  });

  it("marks names you used before, and Escape closes the list", async () => {
    const user = userEvent.setup();
    actions.suggestIngredients.mockResolvedValue({ data: [MINE] });
    renderWithIntl(<Field />);
    await user.type(screen.getByRole("combobox"), "grand");
    expect(await screen.findByRole("option", { name: /Grandma's spice mix/ })).toHaveTextContent("Used before");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });

  it("a slow, older answer never replaces a newer one", async () => {
    const user = userEvent.setup();
    let resolveFirst: (v: unknown) => void = () => {};
    actions.suggestIngredients
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ data: [PASTE] });
    renderWithIntl(<Field />);
    const box = screen.getByRole("combobox");
    await user.type(box, "to");
    await waitFor(() => expect(actions.suggestIngredients).toHaveBeenCalledTimes(1));
    await user.type(box, "mato p");
    await screen.findByRole("option", { name: "Tomato paste" });
    resolveFirst({ data: [MINE] });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("option", { name: /Grandma/ })).not.toBeInTheDocument();
  });
});
