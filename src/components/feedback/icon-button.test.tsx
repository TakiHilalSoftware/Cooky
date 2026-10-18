import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrashIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("uses its label as the accessible name", () => {
    renderWithIntl(
      <IconButton label="Delete dish">
        <TrashIcon aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Delete dish" })).toBeInTheDocument();
  });

  it("explains itself in a tooltip when reached by keyboard", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <IconButton label="Delete dish">
        <TrashIcon aria-hidden="true" />
      </IconButton>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Delete dish" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Delete dish");
  });

  it("explains itself in a tooltip on hover", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <IconButton label="Open timer">
        <TrashIcon aria-hidden="true" />
      </IconButton>,
    );
    await user.hover(screen.getByRole("button", { name: "Open timer" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Open timer");
  });

  it("runs its action on click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithIntl(
      <IconButton label="Delete dish" onClick={onClick}>
        <TrashIcon aria-hidden="true" />
      </IconButton>,
    );
    await user.click(screen.getByRole("button", { name: "Delete dish" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
