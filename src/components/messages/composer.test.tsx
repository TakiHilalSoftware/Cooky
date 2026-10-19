import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  sendTyping: vi.fn(),
  getAttachableDishes: vi.fn(),
}));
vi.mock("@/server/actions/messages", () => actions);
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { Composer } = await import("./composer");

beforeEach(() => {
  for (const fn of [...Object.values(actions), toast.error]) fn.mockReset();
  actions.sendMessage.mockResolvedValue({ data: { id: "m1" } });
  actions.getAttachableDishes.mockResolvedValue({ data: { dishes: [] } });
});

function setup(live = false) {
  const onSending = vi.fn();
  const onSettled = vi.fn();
  renderWithIntl(
    <Composer conversationId="c1" otherName="Lina" live={live} onSending={onSending} onSettled={onSettled} />,
  );
  return { onSending, onSettled, box: screen.getByRole("textbox", { name: "Message to Lina" }) };
}

describe("Composer", () => {
  it("sends trimmed text on Enter and clears the box", async () => {
    const user = userEvent.setup();
    const { box, onSending, onSettled } = setup();
    await user.type(box, "  Salam!  {Enter}");
    await waitFor(() => expect(actions.sendMessage).toHaveBeenCalledWith({ conversationId: "c1", content: "Salam!" }));
    expect(onSending).toHaveBeenCalledWith("Salam!", null);
    expect(onSettled).toHaveBeenCalled();
    expect(box).toHaveValue("");
  });

  it("adds a new line on Shift+Enter instead of sending", async () => {
    const user = userEvent.setup();
    const { box } = setup();
    await user.type(box, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(box).toHaveValue("Line one\nLine two");
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it("can't send nothing", async () => {
    const user = userEvent.setup();
    const { box } = setup();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(box, "   {Enter}");
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it("gives the words back when sending fails, and says why", async () => {
    const user = userEvent.setup();
    actions.sendMessage.mockResolvedValue({ serverError: "forbidden" });
    const { box } = setup();
    await user.type(box, "Are you there?{Enter}");
    await waitFor(() => expect(box).toHaveValue("Are you there?"));
    expect(toast.error).toHaveBeenCalledWith("You can't message Lina right now.");
  });

  it("only says 'typing' when realtime is on, and not on every key", async () => {
    const user = userEvent.setup();
    const quiet = setup(false);
    await user.type(quiet.box, "abc");
    expect(actions.sendTyping).not.toHaveBeenCalled();
  });

  it("throttles typing pings while realtime is on", async () => {
    const user = userEvent.setup();
    const { box } = setup(true);
    await user.type(box, "hello there");
    expect(actions.sendTyping).toHaveBeenCalledTimes(1);
    expect(actions.sendTyping).toHaveBeenCalledWith({ conversationId: "c1" });
  });

  it("explains which dishes can be attached when none can", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Attach one of your dishes" }));
    expect(await screen.findByText(/None of your dishes are shared with Lina yet/)).toBeInTheDocument();
  });
});
