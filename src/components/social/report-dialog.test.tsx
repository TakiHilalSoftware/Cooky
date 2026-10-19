import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ reportContent: vi.fn() }));
vi.mock("@/server/actions/reports", () => actions);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { ReportDialog } = await import("./report-dialog");

beforeEach(() => {
  actions.reportContent.mockReset();
  toast.success.mockReset();
});

describe("ReportDialog", () => {
  it("asks what's wrong before sending anything", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ReportDialog open onOpenChange={() => {}} targetType="user" targetId="u1" subject="Karim" />);
    expect(screen.getByRole("dialog", { name: "Report Karim" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose what's wrong.");
    expect(actions.reportContent).not.toHaveBeenCalled();
  });

  it("sends the reason and details, then closes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    actions.reportContent.mockResolvedValue({ data: { reported: true } });
    renderWithIntl(
      <ReportDialog open onOpenChange={onOpenChange} targetType="message" targetId="m1" subject="Karim" />,
    );
    await user.click(screen.getByRole("radio", { name: "Spam or scam" }));
    await user.type(screen.getByLabelText("Anything else we should know? (optional)"), "  Links to a scam  ");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(actions.reportContent).toHaveBeenCalledWith({
        targetType: "message",
        targetId: "m1",
        reason: "spam",
        details: "Links to a scam",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Thanks. Your report was sent to our team.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open with a friendly message when it can't be sent", async () => {
    const user = userEvent.setup();
    actions.reportContent.mockResolvedValue({ serverError: "not_found" });
    renderWithIntl(<ReportDialog open onOpenChange={() => {}} targetType="dish" targetId="d1" subject="Baklava" />);
    await user.click(screen.getByRole("radio", { name: "Something else" }));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't find that.");
  });
});
