import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeGroq, aiHandlers } from "./support/ai";
import { browser } from "./support/browser";
import { resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const { dictateIngredients } = await import("@/server/actions/voice");
const tries = await import("@/server/quota/tries");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeGroq.reset();
  hibp.use(...aiHandlers);
});

/** The first bytes of a WebM recording (what Chrome's MediaRecorder produces), padded. */
const webm = () => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...Array(4000).fill(1)])], { type: "audio/webm" });

function form(audio: Blob, locale = "en") {
  const data = new FormData();
  data.append("audio", audio);
  data.append("locale", locale);
  return data;
}

async function signedIn() {
  await signUpAndVerify();
  await logIn();
  return (await userByEmail("amina@example.com"))!.id;
}

const used = async (userId: string) => (await tries.usageFor(userId, "voice")).used;

describe("dictateIngredients", () => {
  it("requires a session", async () => {
    expect(await dictateIngredients(form(webm()))).toEqual({ serverError: "unauthorized" });
  });

  it("turns speech into ingredient rows, in the person's language, and spends one try", async () => {
    const userId = await signedIn();
    fakeGroq.transcript = "2 pommes de terre, 500 g de poulet et du sel";
    const { data } = await dictateIngredients(form(webm(), "fr"));
    expect(data?.ingredients).toEqual([
      { amount: 2, unit: null, name: "pommes de terre", note: null },
      { amount: 500, unit: "g", name: "poulet", note: null },
      { amount: null, unit: null, name: "du sel", note: null },
    ]);
    // The provider was told the language (better accuracy, ARCHITECTURE §5.9).
    expect(fakeGroq.requests[0]?.get("language")).toBe("fr");
    expect(await used(userId)).toBe(1);
  });

  it("gives the try back when nothing was heard", async () => {
    const userId = await signedIn();
    fakeGroq.transcript = "   ";
    expect(await dictateIngredients(form(webm()))).toEqual({ serverError: "not_found" });
    expect(await used(userId)).toBe(0);
  });

  it("gives the try back when the provider fails (and never shows its error)", async () => {
    const userId = await signedIn();
    fakeGroq.failWith = 503;
    expect(await dictateIngredients(form(webm()))).toEqual({ serverError: "unavailable" });
    expect(await used(userId)).toBe(0);
  });

  it("refuses something that isn't audio, or is too big, without calling the provider", async () => {
    const userId = await signedIn();
    const notAudio = new Blob(["<html>"], { type: "audio/webm" });
    expect(await dictateIngredients(form(notAudio))).toEqual({ serverError: "invalid" });
    const huge = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), new Uint8Array(4 * 1024 * 1024)]);
    expect(await dictateIngredients(form(huge))).toEqual({ serverError: "invalid" });
    expect(fakeGroq.requests).toHaveLength(0);
    expect(await used(userId)).toBe(0);
  });

  it("on Free, the 11th dictation in a month opens the upgrade sheet, without calling the provider", async () => {
    await signedIn();
    fakeGroq.transcript = "salt";
    for (let i = 0; i < 10; i++) expect((await dictateIngredients(form(webm()))).data).toBeDefined();
    fakeGroq.requests = [];
    expect(await dictateIngredients(form(webm()))).toEqual({ serverError: "quota_exceeded" });
    expect(fakeGroq.requests).toHaveLength(0);
  });
});
