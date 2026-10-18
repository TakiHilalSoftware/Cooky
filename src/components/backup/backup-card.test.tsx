import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BackupOverviewDto } from "@/server/features/backup/dto";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ exportBackup: vi.fn(), importBackup: vi.fn() }));
vi.mock("@/server/actions/backup", () => actions);
const upgrade = vi.hoisted(() => ({ open: vi.fn(), onError: vi.fn() }));
vi.mock("@/components/paywall/upgrade-sheet-provider", () => ({
  useUpgradeSheet: () => upgrade.open,
  useActionErrorHandler: () => upgrade.onError,
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { BackupCard } = await import("./backup-card");

const overview = (overrides: Partial<BackupOverviewDto> = {}): BackupOverviewDto => ({
  dishCount: 12,
  canImport: true,
  latestImport: null,
  ...overrides,
});

const backupFile = (text: string, name = "cooky.json") => new File([text], name, { type: "application/json" });
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

beforeEach(() => {
  for (const fn of [
    actions.exportBackup,
    actions.importBackup,
    upgrade.open,
    upgrade.onError,
    router.refresh,
    toast.success,
  ]) {
    fn.mockReset();
  }
});
afterEach(() => vi.useRealTimers());

describe("BackupCard", () => {
  it("downloads the backup the server built", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:backup");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    actions.exportBackup.mockResolvedValue({ data: { filename: "cooky-recipes-2026-10-18.json", content: "{}" } });
    renderWithIntl(<BackupCard overview={overview()} />);

    await user.click(screen.getByRole("button", { name: "Download backup (12 dishes)" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(click.mock.contexts[0]).toMatchObject({ download: "cooky-recipes-2026-10-18.json", href: "blob:backup" });
    expect(toast.success).toHaveBeenCalledWith("Backup downloaded");
  });

  it("an empty box has nothing to download, and says so", () => {
    renderWithIntl(<BackupCard overview={overview({ dishCount: 0 })} />);
    expect(screen.getByText("Your box is empty, so there's nothing to back up yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download backup/ })).not.toBeInTheDocument();
  });

  it("on Free, choosing a file opens the upgrade sheet instead of the file picker", async () => {
    const user = userEvent.setup();
    renderWithIntl(<BackupCard overview={overview({ canImport: false })} />);
    expect(screen.getByText("Importing a backup is part of Plus and Pro.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose a backup file" }));
    expect(upgrade.open).toHaveBeenCalledWith({ feature: "backup_import", reason: "plan_required" });
  });

  it("sends the file's text and confirms it's importing", async () => {
    const user = userEvent.setup();
    actions.importBackup.mockResolvedValue({ data: { status: "queued", total: 3 } });
    renderWithIntl(<BackupCard overview={overview()} />);
    await user.upload(fileInput(), backupFile('{"format":"cooky-backup"}'));
    await waitFor(() => expect(actions.importBackup).toHaveBeenCalledWith({ content: '{"format":"cooky-backup"}' }));
    expect(toast.success).toHaveBeenCalledWith("Importing 3 dishes…");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("explains a file the server can't use", async () => {
    const user = userEvent.setup();
    actions.importBackup.mockResolvedValue({ data: { status: "invalid", problem: "not_json" } });
    renderWithIntl(<BackupCard overview={overview()} />);
    await user.upload(fileInput(), backupFile("nope"));
    expect(await screen.findByText(/That file isn't a Cooky backup/)).toBeInTheDocument();
  });

  it("turns away a file over 5 MB before uploading it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<BackupCard overview={overview()} />);
    await user.upload(fileInput(), backupFile("x".repeat(5 * 1024 * 1024 + 1)));
    expect(await screen.findByText("That file is over 5 MB. Choose a smaller backup.")).toBeInTheDocument();
    expect(actions.importBackup).not.toHaveBeenCalled();
  });

  it("while an import runs: says so, blocks a second one, and re-reads the result", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithIntl(
      <BackupCard
        overview={overview({
          latestImport: {
            status: "running",
            total: 40,
            imported: 0,
            skipped: { duplicate: 0, full: 0, invalid: 0 },
            createdAt: "2026-10-18T12:00:00Z",
          },
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Importing your recipes…");
    expect(screen.getByRole("button", { name: "Choose a backup file" })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the last result with the reasons dishes were skipped", () => {
    renderWithIntl(
      <BackupCard
        overview={overview({
          latestImport: {
            status: "done",
            total: 45,
            imported: 42,
            skipped: { duplicate: 2, full: 0, invalid: 1 },
            createdAt: "2026-10-18T12:00:00Z",
          },
        })}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Last import: 42 dishes added");
    expect(status).toHaveTextContent("2 were already in your box");
    expect(status).toHaveTextContent("1 couldn't be read");
    expect(status).not.toHaveTextContent("didn't fit");
  });
});
