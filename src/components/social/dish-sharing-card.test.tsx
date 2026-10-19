import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DishSharingDto } from "@/server/features/social/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ setDishSharing: vi.fn() }));
vi.mock("@/server/actions/sharing", () => actions);
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { DishSharingCard } = await import("./dish-sharing-card");

const sharing = (overrides: Partial<DishSharingDto> = {}): DishSharingDto => ({
  visibility: "private",
  groupIds: [],
  groups: [
    { id: "g-family", name: "Family", memberCount: 3 },
    { id: "g-work", name: "Work", memberCount: 0 },
  ],
  friendCount: 5,
  ...overrides,
});

beforeEach(() => {
  actions.setDishSharing.mockReset();
  actions.setDishSharing.mockImplementation(async (input: { visibility: string; groupIds: string[] }) => ({
    data: input,
  }));
});

describe("DishSharingCard", () => {
  it("offers Save only once something changed", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishSharingCard dishId="d1" sharing={sharing()} />);
    expect(screen.queryByRole("button", { name: "Save sharing" })).not.toBeInTheDocument();
    expect(screen.getByText("Your 5 friends can see it.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /All my friends/ }));
    await user.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() =>
      expect(actions.setDishSharing).toHaveBeenCalledWith({ dishId: "d1", visibility: "friends", groupIds: [] }),
    );
    expect(toast.success).toHaveBeenCalledWith("Your friends can see this dish now.");
  });

  it("needs at least one group before sharing with groups", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishSharingCard dishId="d1" sharing={sharing()} />);
    await user.click(screen.getByRole("radio", { name: /Chosen groups/ }));
    expect(screen.getByText("Choose at least one group.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save sharing" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Family/ }));
    await user.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() =>
      expect(actions.setDishSharing).toHaveBeenCalledWith({
        dishId: "d1",
        visibility: "groups",
        groupIds: ["g-family"],
      }),
    );
  });

  it("points to Friends when there are no groups yet", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DishSharingCard dishId="d1" sharing={sharing({ groups: [] })} />);
    await user.click(screen.getByRole("radio", { name: /Chosen groups/ }));
    expect(screen.getByRole("link", { name: "Create one in Friends" })).toHaveAttribute("href", "/friends");
  });
});
