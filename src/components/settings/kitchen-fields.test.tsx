import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { DEFAULT_MEAL_TIMES } from "@/lib/meal-times";

import { renderWithIntl } from "../../../tests/setup/render";
import { KitchenFields, type KitchenValues } from "./kitchen-fields";

const EMPTY: KitchenValues = {
  city: "",
  latitude: null,
  longitude: null,
  dietaryPrefs: [],
  mealTimes: DEFAULT_MEAL_TIMES,
};

function Harness({ initial, suggestedCity }: { initial: KitchenValues; suggestedCity: string | null }) {
  const [values, setValues] = useState(initial);
  return <KitchenFields values={values} onChange={setValues} parts={["city"]} suggestedCity={suggestedCity} />;
}

describe("KitchenFields: the city suggested from the connection", () => {
  it("offers it in one tap when no city is set, and says where it comes from", async () => {
    renderWithIntl(<Harness initial={EMPTY} suggestedCity="Algiers" />);
    const use = screen.getByRole("button", { name: "Use Algiers" });
    expect(use).toHaveAttribute("title", "Suggested from your internet connection, so it's approximate.");
    await userEvent.click(use);
    expect(screen.getByLabelText("City")).toHaveValue("Algiers");
    // Filled in, it explains itself and invites a correction; the button has done its job.
    expect(screen.getByText("Suggested from your connection. Change it if it's not right.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Algiers" })).not.toBeInTheDocument();
  });

  it("drops the note as soon as the person types their own city", async () => {
    renderWithIntl(<Harness initial={{ ...EMPTY, city: "Algiers" }} suggestedCity="Algiers" />);
    const field = screen.getByLabelText("City");
    await userEvent.clear(field);
    await userEvent.type(field, "Blida");
    expect(screen.queryByText(/Suggested from your connection/)).not.toBeInTheDocument();
  });

  it("stays out of the way once a device location is set", () => {
    renderWithIntl(<Harness initial={{ ...EMPTY, latitude: 36.75, longitude: 3.06 }} suggestedCity="Algiers" />);
    expect(screen.queryByRole("button", { name: "Use Algiers" })).not.toBeInTheDocument();
  });

  it("shows nothing extra without a suggestion (off Vercel, or a place already saved)", () => {
    renderWithIntl(<Harness initial={EMPTY} suggestedCity={null} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Use my location"]);
  });
});
