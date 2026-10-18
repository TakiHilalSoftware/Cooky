import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "@/lib/appearance";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const settings = await import("@/server/actions/settings");
const authActions = await import("@/server/actions/auth");
const { getAppearance, getProfileSettings } = await import("@/server/features/profile/queries");
const { drainOutbox } = await import("@/server/outbox/drain");
const schema = await import("@/server/db/schema");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  sendEmail.mockReset().mockResolvedValue(undefined);
});

async function profileOf(email: string) {
  const user = await userByEmail(email);
  const [profile] = await db().select().from(schema.profiles).where(eq(schema.profiles.userId, user!.id));
  return profile!;
}

describe("profile settings", () => {
  it("saves a trimmed display name to the caller's own profile only", async () => {
    await signUpAndVerify("karim@example.com");
    await signUpAndVerify("amina@example.com");
    await logIn();

    expect(await settings.updateDisplayName({ displayName: "  Amina B.  " })).toEqual({
      data: { displayName: "Amina B." },
    });
    expect((await profileOf("amina@example.com")).displayName).toBe("Amina B.");
    expect((await profileOf("karim@example.com")).displayName).toBe("Amina Benali");
    expect(await getProfileSettings()).toMatchObject({
      displayName: "Amina B.",
      initials: "AB",
      email: "amina@example.com",
    });
  });

  it("rejects an empty or too-long name", async () => {
    await signUpAndVerify();
    await logIn();
    expect((await settings.updateDisplayName({ displayName: "   " })).validationErrors).toBeDefined();
    expect((await settings.updateDisplayName({ displayName: "x".repeat(61) })).validationErrors).toBeDefined();
  });

  it("refuses every change without a session", async () => {
    expect(await settings.updateDisplayName({ displayName: "Hacker" })).toEqual({ serverError: "unauthorized" });
    expect(await settings.updateAppearance({ accent: "rose" })).toEqual({ serverError: "unauthorized" });
    expect(await settings.updateLocale({ locale: "ar" })).toEqual({ serverError: "unauthorized" });
  });
});

describe("appearance", () => {
  it("uses the defaults for visitors who aren't signed in", async () => {
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("saves each choice on its own and serves it for every page", async () => {
    await signUpAndVerify();
    await logIn();
    await settings.updateAppearance({ accent: "mint" });
    await settings.updateAppearance({ textSize: "xl" });
    await settings.updateAppearance({ theme: "dark" });
    expect(await getAppearance()).toEqual({ accent: "mint", textSize: "xl", theme: "dark" });
  });

  it("only accepts the documented choices", async () => {
    await signUpAndVerify();
    await logIn();
    // @ts-expect-error: the client can send anything; the schema must reject it.
    expect((await settings.updateAppearance({ accent: "neon" })).validationErrors).toBeDefined();
    expect((await settings.updateAppearance({})).validationErrors).toBeDefined();
    expect((await profileOf("amina@example.com")).accent).toBe("default");
  });
});

describe("language", () => {
  it("makes later emails arrive in the language chosen in the switcher", async () => {
    await signUpAndVerify();
    await logIn();
    await settings.updateLocale({ locale: "ar" });
    await authActions.signOut();
    browser.reset();

    sendEmail.mockClear();
    await authActions.requestPasswordReset({ email: "amina@example.com", locale: "ar" });
    await drainOutbox({ limit: 10 });
    const [, email] = sendEmail.mock.calls.at(-1) as unknown as [string, { subject: string }];
    expect(email.subject).toBe("إعادة تعيين كلمة مرور Cooky");
  });
});
