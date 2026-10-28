import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MEAL_TIMES, type MealTimes } from "@/lib/meal-times";

import { renderWithIntl } from "../../../tests/setup/render";
import { MealTimesFields } from "./meal-times-fields";

/** The fields as a form holds them, reporting each change. */
function Harness({ initial, onChange }: { initial: MealTimes; onChange: (next: MealTimes) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MealTimesFields
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("MealTimesFields", () => {
  it("shows each meal in the order of a day, with its time", () => {
    renderWithIntl(<Harness initial={DEFAULT_MEAL_TIMES} onChange={vi.fn()} />);
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-checked"))).toEqual([
      "true",
      "true",
      "true",
      "true",
    ]);
    expect(screen.getByLabelText("Lunch time")).toHaveValue("12:30");
    expect(screen.getByLabelText("Snack time")).toHaveValue("16:30");
  });

  it("changes a time in minutes after midnight", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness initial={DEFAULT_MEAL_TIMES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Lunch time"), { target: { value: "13:15" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_MEAL_TIMES, lunch: 13 * 60 + 15 });
  });

  it("turns a meal off, and back on with the time it had", async () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness initial={DEFAULT_MEAL_TIMES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Snack time"), { target: { value: "17:00" } });
    await userEvent.click(screen.getByRole("checkbox", { name: "Snack" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_MEAL_TIMES, snack: null });
    expect(screen.getByLabelText("Snack time")).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Snack" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_MEAL_TIMES, snack: 17 * 60 });
  });

  it("ignores a cleared time instead of silently switching the meal off", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness initial={DEFAULT_MEAL_TIMES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Dinner time"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says what happens when every meal is off", () => {
    renderWithIntl(
      <Harness initial={{ breakfast: null, lunch: null, snack: null, dinner: null }} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/Cook ranks your dishes without a meal in mind/)).toBeInTheDocument();
  });

  it("is the anchor Cook's “Meal times” link opens", () => {
    const { container } = renderWithIntl(<Harness initial={DEFAULT_MEAL_TIMES} onChange={vi.fn()} />);
    expect(container.querySelector("fieldset#meal-times")).not.toBeNull();
  });
});
