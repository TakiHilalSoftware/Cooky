import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { auditActions, db, latestEmailJob, resetData, userByEmail } from "./support/db";
import { expectRedirect, logIn, NEW_PASSWORD, PASSWORD, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const { auth } = await import("@/server/auth/auth");
const { getSession } = await import("@/server/auth/session");
const authActions = await import("@/server/actions/auth");
const security = await import("@/server/actions/security");
const { getSecurityOverview } = await import("@/server/features/security/queries");
const schema = await import("@/server/db/schema");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  sendEmail.mockReset().mockResolvedValue(undefined);
});

/** What an authenticator app shows for this secret right now. */
function currentCode(secret: string) {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
}

/** Signs in and turns on 2FA; returns the secret and backup codes. */
async function enableTwoFactor() {
  await signUpAndVerify();
  await logIn();
  const started = await security.startTwoFactorSetup({ password: PASSWORD });
  const setup = started.data;
  if (!setup || !("secret" in setup)) throw new Error("2FA setup did not start");
  expect(setup.qrSvg).toContain("<svg");
  const confirmed = await security.confirmTwoFactorSetup({ code: currentCode(setup.secret) });
  expect(confirmed).toEqual({ data: { status: "enabled" } });
  return setup;
}

describe("two-step verification", () => {
  it("is switched on only after a correct code from the app, and audited", async () => {
    await signUpAndVerify();
    await logIn();
    const started = await security.startTwoFactorSetup({ password: PASSWORD });
    const setup = started.data;
    if (!setup || !("secret" in setup)) throw new Error("no setup");

    expect((await userByEmail("amina@example.com"))?.twoFactorEnabled).toBeFalsy();
    expect(await security.confirmTwoFactorSetup({ code: "000000" })).toEqual({ data: { status: "invalid_code" } });
    expect(await security.confirmTwoFactorSetup({ code: currentCode(setup.secret) })).toEqual({
      data: { status: "enabled" },
    });

    const user = await userByEmail("amina@example.com");
    expect(user?.twoFactorEnabled).toBe(true);
    expect(await auditActions(user!.id)).toContain("auth.2fa_enabled");
    expect(setup.backupCodes).toHaveLength(10);
  });

  // Regression: enabling 2FA replaces the session inside the action. Next's
  // headers() still carries the old cookie there; reading the session from it
  // bounced people to log in before they could save their backup codes.
  it("keeps the person signed in through the session swap that turning on 2FA causes", async () => {
    await signUpAndVerify();
    await logIn();
    const started = await security.startTwoFactorSetup({ password: PASSWORD });
    const setup = started.data;
    if (!setup || !("secret" in setup)) throw new Error("no setup");

    browser.freeze();
    try {
      expect(await security.confirmTwoFactorSetup({ code: currentCode(setup.secret) })).toEqual({
        data: { status: "enabled" },
      });
      // Same request: the page re-render must still see a signed-in person.
      expect((await getSession())?.user.email).toBe("amina@example.com");
    } finally {
      browser.thaw();
    }
  });

  it("refuses to start without the right password", async () => {
    await signUpAndVerify();
    await logIn();
    expect(await security.startTwoFactorSetup({ password: "not my password" })).toEqual({
      data: { status: "wrong_password" },
    });
  });

  it("asks for a code after the password, and only signs in with a correct one", async () => {
    const setup = await enableTwoFactor();
    await authActions.signOut();
    browser.reset();

    await expectRedirect(
      authActions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" }),
      "/en/two-factor",
    );
    // The password alone didn't create a usable session.
    expect(await getSession()).toBeNull();

    expect(await authActions.verifyTwoFactorCode({ code: "123456", trustDevice: false, locale: "en" })).toEqual({
      data: { status: "invalid_code" },
    });
    await expectRedirect(
      authActions.verifyTwoFactorCode({ code: currentCode(setup.secret), trustDevice: false, locale: "en" }),
      "/en/dishes",
    );
    expect((await getSession())?.user.email).toBe("amina@example.com");
  });

  it("accepts each backup code once", async () => {
    const setup = await enableTwoFactor();
    const [code] = setup.backupCodes;

    for (const attempt of ["first", "second"] as const) {
      await authActions.signOut().catch(() => undefined);
      browser.reset();
      await expectRedirect(
        authActions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" }),
        "/two-factor",
      );
      const result = authActions.verifyBackupCode({ code: code!, locale: "en" });
      if (attempt === "first") await expectRedirect(result, "/en/dishes");
      else await expect(result).resolves.toEqual({ data: { status: "invalid_code" } });
    }
  });

  it("says the sign-in expired when there's no pending 2FA step", async () => {
    expect(await authActions.verifyTwoFactorCode({ code: "123456", trustDevice: false, locale: "en" })).toEqual({
      data: { status: "expired" },
    });
  });

  it("can be turned off with the password", async () => {
    await enableTwoFactor();
    expect(await security.disableTwoFactor({ password: "wrong" })).toEqual({ data: { status: "wrong_password" } });
    expect(await security.disableTwoFactor({ password: PASSWORD })).toEqual({ data: { status: "ok" } });
    expect((await userByEmail("amina@example.com"))?.twoFactorEnabled).toBe(false);
  });
});

describe("progressive lockout", () => {
  async function failLogin(email: string, times: number) {
    for (let i = 0; i < times; i++) await authActions.signIn({ email, password: "wrong password", locale: "en" });
  }

  it("locks an account after 5 wrong passwords, even for the right one, then tells when to retry", async () => {
    await signUpAndVerify();
    await failLogin("amina@example.com", 4);
    expect(await authActions.signIn({ email: "amina@example.com", password: "wrong", locale: "en" })).toEqual({
      data: { status: "invalid_credentials" },
    });

    const locked = await authActions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" });
    expect(locked.data?.status).toBe("locked");
    const retryAt = locked.data?.status === "locked" ? new Date(locked.data.retryAt!) : new Date(0);
    expect(retryAt.getTime() - Date.now()).toBeGreaterThan(50_000);
    expect(retryAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
  });

  it("also guards Better Auth's own sign-in endpoint, not just our action", async () => {
    await signUpAndVerify();
    await failLogin("amina@example.com", 5);
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "amina@example.com", password: PASSWORD }),
      }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_LOCKED" });
  });

  it("behaves the same for an email with no account (no enumeration)", async () => {
    await failLogin("nobody@example.com", 5);
    const result = await authActions.signIn({ email: "nobody@example.com", password: PASSWORD, locale: "en" });
    expect(result.data?.status).toBe("locked");
  });

  it("stores no email address, only a keyed hash", async () => {
    await failLogin("amina@example.com", 1);
    const rows = await db().select().from(schema.loginAttempts);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("amina");
  });

  it("forgets earlier failures after a correct password", async () => {
    await signUpAndVerify();
    await failLogin("amina@example.com", 4);
    await logIn();
    await authActions.signOut();
    browser.reset();
    await failLogin("amina@example.com", 4);
    await logIn(); // a 5th failure would have locked it if the count had carried over
  });
});

describe("change password", () => {
  it("rejects a wrong current password", async () => {
    await signUpAndVerify();
    await logIn();
    expect(await security.changePassword({ currentPassword: "wrong", newPassword: NEW_PASSWORD })).toEqual({
      data: { status: "wrong_password" },
    });
  });

  it("changes it, keeps this device, signs out the others, emails a heads-up and audits it", async () => {
    await signUpAndVerify();
    // Another device.
    await logIn();
    const otherDevice = new Map(browser.cookies);
    browser.reset();
    // This device.
    await logIn();
    const thisSessionUser = (await getSession())!.user.id;

    expect(await security.changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).toEqual({
      data: { status: "changed" },
    });
    expect((await getSession())?.user.id).toBe(thisSessionUser);
    expect(await db().select().from(schema.session)).toHaveLength(1);

    browser.cookies.clear();
    for (const [k, v] of otherDevice) browser.cookies.set(k, v);
    expect(await getSession()).toBeNull();

    expect((await latestEmailJob())?.payload).toMatchObject({ template: "passwordChanged", to: "amina@example.com" });
    expect(await auditActions(thisSessionUser)).toContain("auth.password_changed");
  });
});

describe("signed-in devices", () => {
  it("lists devices with readable names and marks this one, without exposing tokens", async () => {
    await signUpAndVerify();
    browser.headers.set(
      "user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
    );
    await logIn();
    const overview = await getSecurityOverview();
    // Two sessions: the email-confirmation link signed in too. This one is listed first.
    expect(overview?.devices.filter((d) => d.current)).toHaveLength(1);
    expect(overview?.devices[0]).toMatchObject({ browser: "Chrome", os: "Windows", kind: "computer", current: true });
    const tokens = (await db().select({ token: schema.session.token }).from(schema.session)).map((s) => s.token);
    for (const token of tokens) expect(JSON.stringify(overview)).not.toContain(token);
  });

  it("signs out another of your devices, but never someone else's or this one", async () => {
    await signUpAndVerify("amina@example.com");
    await signUpAndVerify("karim@example.com");
    await logIn("karim@example.com");
    const karimSession = (await getSession())!.session.id;
    browser.reset();

    await logIn();
    const aminaOther = (await getSession())!.session.id;
    browser.reset();
    await logIn();
    const aminaHere = (await getSession())!.session.id;

    expect(await security.revokeDevice({ sessionId: karimSession })).toEqual({ serverError: "not_found" });
    expect(await security.revokeDevice({ sessionId: aminaHere })).toEqual({ serverError: "invalid" });
    expect(await security.revokeDevice({ sessionId: aminaOther })).toEqual({});

    const remaining = (await db().select({ id: schema.session.id }).from(schema.session)).map((s) => s.id);
    expect(remaining).toContain(karimSession);
    expect(remaining).toContain(aminaHere);
    expect(remaining).not.toContain(aminaOther);
  });
});

describe("passkeys", () => {
  it("only lets owners rename or remove a passkey", async () => {
    await signUpAndVerify("karim@example.com");
    const karim = await userByEmail("karim@example.com");
    await db().insert(schema.passkey).values({
      id: "karims-passkey",
      name: "Karim's phone",
      publicKey: "pk",
      userId: karim!.id,
      credentialID: "cred-1",
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
    });

    await signUpAndVerify("amina@example.com");
    await logIn();
    expect(await security.deletePasskey({ id: "karims-passkey" })).toEqual({ serverError: "not_found" });
    expect(await security.renamePasskey({ id: "karims-passkey", name: "Mine now" })).toEqual({
      serverError: "not_found",
    });

    const [row] = await db().select().from(schema.passkey).where(eq(schema.passkey.id, "karims-passkey"));
    expect(row?.name).toBe("Karim's phone");
  });

  it("prepares a registration challenge for a signed-in person only", async () => {
    expect(await security.passkeyRegistrationOptions()).toEqual({ serverError: "unauthorized" });
    await signUpAndVerify();
    await logIn();
    const options = await security.passkeyRegistrationOptions();
    expect(options.data).toMatchObject({ rp: { name: "Cooky", id: "localhost" }, challenge: expect.any(String) });
  });
});
