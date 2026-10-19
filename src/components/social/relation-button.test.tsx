import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Relation } from "@/lib/social";

import { renderWithIntl } from "../../../tests/setup/render";

const friends = vi.hoisted(() => ({ sendFriendRequest: vi.fn(), cancelFriendRequest: vi.fn() }));
vi.mock("@/server/actions/friends", () => friends);
const messages = vi.hoisted(() => ({ openConversation: vi.fn() }));
vi.mock("@/server/actions/messages", () => messages);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { RelationButton } = await import("./relation-button");

const lina = (relation: Relation) => ({ id: "u_lina", displayName: "Lina", relation });

beforeEach(() => {
  for (const fn of [...Object.values(friends), messages.openConversation, router.push, toast.success, toast.error])
    fn.mockReset();
});

describe("RelationButton", () => {
  it("adds a friend and shows 'Requested' at once", async () => {
    const user = userEvent.setup();
    let resolve: (value: unknown) => void = () => {};
    friends.sendFriendRequest.mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithIntl(<RelationButton person={lina("none")} />);
    await user.click(screen.getByRole("button", { name: "Add friend" }));
    expect(await screen.findByRole("button", { name: "Requested" })).toBeInTheDocument();
    resolve({ data: { relation: "outgoing" } });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Friend request sent to Lina."));
    expect(friends.sendFriendRequest).toHaveBeenCalledWith({ userId: "u_lina" });
  });

  it("follows the server when sending turns out to accept their request", async () => {
    const user = userEvent.setup();
    friends.sendFriendRequest.mockResolvedValue({ data: { relation: "friend" } });
    renderWithIntl(<RelationButton person={lina("none")} />);
    await user.click(screen.getByRole("button", { name: "Add friend" }));
    expect(await screen.findByRole("button", { name: "Message" })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("You and Lina are now friends.");
  });

  it("goes back to 'Add friend' and explains the hourly limit when refused", async () => {
    const user = userEvent.setup();
    friends.sendFriendRequest.mockResolvedValue({ serverError: "rate_limited" });
    renderWithIntl(<RelationButton person={lina("none")} />);
    await user.click(screen.getByRole("button", { name: "Add friend" }));
    expect(await screen.findByRole("button", { name: "Add friend" })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("That's a lot of requests in an hour. Try again a little later.");
  });

  it("cancels a pending request", async () => {
    const user = userEvent.setup();
    friends.cancelFriendRequest.mockResolvedValue({ data: { relation: "none" } });
    renderWithIntl(<RelationButton person={lina("outgoing")} />);
    await user.click(screen.getByRole("button", { name: "Requested" }));
    expect(await screen.findByRole("button", { name: "Add friend" })).toBeInTheDocument();
    expect(friends.cancelFriendRequest).toHaveBeenCalledWith({ userId: "u_lina" });
  });

  it("opens the chat with a friend", async () => {
    const user = userEvent.setup();
    messages.openConversation.mockResolvedValue({ data: { conversationId: "c1" } });
    renderWithIntl(<RelationButton person={lina("friend")} />);
    await user.click(screen.getByRole("button", { name: "Message" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/messages/c1"));
  });

  it("sends their request to the Requests list instead of accepting blindly", () => {
    renderWithIntl(<RelationButton person={lina("incoming")} />);
    expect(screen.getByRole("link", { name: "Answer request" })).toHaveAttribute("href", "/friends#requests");
  });
});
