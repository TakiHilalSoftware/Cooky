import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../../tests/setup/render";

const actions = vi.hoisted(() => ({ dictateIngredients: vi.fn() }));
vi.mock("@/server/actions/voice", () => actions);
const onActionError = vi.hoisted(() => vi.fn());
vi.mock("@/components/paywall/upgrade-sheet-provider", () => ({ useActionErrorHandler: () => onActionError }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { VoiceDictation } = await import("./voice-dictation");

/** A recorder that hands back `bytes` of audio when stopped, like the browser's. */
function fakeRecorder(bytes: number) {
  return class FakeRecorder {
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    stream: { getTracks: () => { stop: () => void }[] };
    constructor(stream: FakeRecorder["stream"]) {
      this.stream = stream;
    }
    start() {}
    stop() {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
      this.onstop?.();
    }
  };
}

const stream = { getTracks: () => [{ stop: vi.fn() }] };
const getUserMedia = vi.fn();

beforeEach(() => {
  for (const fn of [actions.dictateIngredients, onActionError, toast.success, getUserMedia]) fn.mockReset();
  getUserMedia.mockResolvedValue(stream);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MediaRecorder", fakeRecorder(5_000));
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

async function record(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Dictate ingredients" }));
  expect(await screen.findByText(/Listening/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Stop and add/ }));
}

describe("VoiceDictation", () => {
  it("sends the recording with the locale and hands the rows back", async () => {
    const user = userEvent.setup();
    const onIngredients = vi.fn();
    const rows = [{ name: "potatoes", amount: 2, unit: null, note: null }];
    actions.dictateIngredients.mockResolvedValue({ data: { ingredients: rows } });
    renderWithIntl(<VoiceDictation onIngredients={onIngredients} />);
    await record(user);
    await waitFor(() => expect(onIngredients).toHaveBeenCalledWith(rows));
    const form: FormData = actions.dictateIngredients.mock.calls[0]![0];
    expect(form.get("locale")).toBe("en");
    expect(form.get("audio")).toBeInstanceOf(Blob);
    expect(toast.success).toHaveBeenCalledWith("Added 1 ingredient. Check them below.");
  });

  it("doesn't spend a request on a recording with nothing in it", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("MediaRecorder", fakeRecorder(100));
    renderWithIntl(<VoiceDictation onIngredients={vi.fn()} />);
    await record(user);
    expect(await screen.findByText(/didn't hear anything/)).toBeInTheDocument();
    expect(actions.dictateIngredients).not.toHaveBeenCalled();
  });

  it("explains a blocked microphone and never records", async () => {
    const user = userEvent.setup();
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    renderWithIntl(<VoiceDictation onIngredients={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Dictate ingredients" }));
    expect(await screen.findByText(/blocked the microphone/)).toBeInTheDocument();
  });

  it("says when the browser can't record at all", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("MediaRecorder", undefined);
    renderWithIntl(<VoiceDictation onIngredients={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Dictate ingredients" }));
    expect(await screen.findByText("This browser can't record audio. Typing works everywhere.")).toBeInTheDocument();
  });

  it("opens the upgrade sheet when the voice tries are used up", async () => {
    const user = userEvent.setup();
    actions.dictateIngredients.mockResolvedValue({ serverError: "quota_exceeded" });
    renderWithIntl(<VoiceDictation onIngredients={vi.fn()} />);
    await record(user);
    await waitFor(() => expect(onActionError).toHaveBeenCalledWith("quota_exceeded", "voice"));
  });

  it("tells the user the try came back when no provider can transcribe", async () => {
    const user = userEvent.setup();
    actions.dictateIngredients.mockResolvedValue({ serverError: "unavailable" });
    renderWithIntl(<VoiceDictation onIngredients={vi.fn()} />);
    await record(user);
    expect(await screen.findByText(/Your try wasn't used/)).toBeInTheDocument();
  });
});
