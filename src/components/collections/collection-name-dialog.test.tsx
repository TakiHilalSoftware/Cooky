import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ createCollection: vi.fn(), renameCollection: vi.fn() }));
vi.mock("@/server/actions/collections", () => actions);
const onActionError = vi.hoisted(() => vi.fn());
vi.mock("@/components/paywall/upgrade-sheet-provider", () => ({ useActionErrorHandler: () => onActionError }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { CollectionNameDialog } = await import("./collection-name-dialog");

beforeEach(() => {
  for (const fn of [actions.createCollection, actions.renameCollection, onActionError, toast.success]) fn.mockReset();
});

describe("CollectionNameDialog", () => {
  it("creates a collection and hands it back", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const onOpenChange = vi.fn();
    actions.createCollection.mockResolvedValue({ data: { id: "c1", name: "Ramadan" } });
    renderWithIntl(<CollectionNameDialog open onOpenChange={onOpenChange} onDone={onDone} />);
    expect(screen.getByRole("dialog", { name: "New collection" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Ramadan");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ id: "c1", name: "Ramadan" }));
    expect(actions.createCollection).toHaveBeenCalledWith({ name: "Ramadan" });
    expect(toast.success).toHaveBeenCalledWith("“Ramadan” created");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks for a name before calling the server", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CollectionNameDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Give the collection a name.");
    expect(actions.createCollection).not.toHaveBeenCalled();
  });

  it("explains a name that's already used", async () => {
    const user = userEvent.setup();
    actions.createCollection.mockResolvedValue({ serverError: "conflict" });
    renderWithIntl(<CollectionNameDialog open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Ramadan");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("You already have a collection with that name.")).toBeInTheDocument();
  });

  it("a full plan closes the dialog and opens the upgrade sheet for collections", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    actions.createCollection.mockResolvedValue({ serverError: "quota_exceeded" });
    renderWithIntl(<CollectionNameDialog open onOpenChange={onOpenChange} />);
    await user.type(screen.getByLabelText("Name"), "Fourth");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onActionError).toHaveBeenCalledWith("quota_exceeded", "collections"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renames, starting from the current name", async () => {
    const user = userEvent.setup();
    actions.renameCollection.mockResolvedValue({ data: { id: "c1", name: "Iftar" } });
    renderWithIntl(<CollectionNameDialog open onOpenChange={() => {}} collection={{ id: "c1", name: "Ramadan" }} />);
    expect(screen.getByRole("dialog", { name: "Rename “Ramadan”" })).toBeInTheDocument();
    const input = screen.getByLabelText("Name");
    expect(input).toHaveValue("Ramadan");
    await user.clear(input);
    await user.type(input, "Iftar");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(actions.renameCollection).toHaveBeenCalledWith({ id: "c1", name: "Iftar" }));
    expect(toast.success).toHaveBeenCalledWith("Renamed to “Iftar”");
  });
});
