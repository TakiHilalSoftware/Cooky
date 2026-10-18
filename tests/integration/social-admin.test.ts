import { execFileSync } from "node:child_process";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { browser } from "./support/browser";
import { auditActions, db, resetData, userByEmail } from "./support/db";
import { logIn, PASSWORD, signUpAndVerify } from "./support/flows";
import { googleAccount, googleTokenHandler } from "./support/google";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const { auth } = await import("@/server/auth/auth");
const { getSession } = await import("@/server/auth/session");
const authActions = await import("@/server/actions/auth");
const { adminAction } = await import("@/server/actions/_clients");
const schema = await import("@/server/db/schema");

beforeAll(() => {
  hibp.use(googleTokenHandler);
  hibp.listen({ onUnhandledFrame: "error" });
});
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  hibp.resetHandlers();
  hibp.use(googleTokenHandler);
  Object.assign(googleAccount, {
    sub: "google-user-1",
    email: "amina@example.com",
    email_verified: true,
    name: "Amina Benali",
  });
});

/** "Continue with Google", then Google sends the person back to our callback. */
async function continueWithGoogle(next?: string) {
  const started = await authActions.startSocialSignIn({ provider: "google", next, locale: "fr" });
  const url = new URL(started.data!.url);
  const state = url.searchParams.get("state")!;
  const callback = await auth.handler(
    new Request(`http://localhost:3000/api/auth/callback/google?code=google-code&state=${state}`, {
      headers: browser.requestHeaders(),
    }),
  );
  browser.absorb(callback);
  return { url, callback };
}

describe("Continue with Google", () => {
  it("sends the browser to Google with our callback and a state cookie", async () => {
    const { url } = await continueWithGoogle();
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/google");
  });

  it("refuses a provider that isn't configured", async () => {
    expect(await authActions.startSocialSignIn({ provider: "apple", locale: "en" })).toEqual({
      serverError: "unavailable",
    });
  });

  it("creates a confirmed account with profile, consents and audit, and signs in", async () => {
    browser.cookies.set("NEXT_LOCALE", "ar");
    const { callback } = await continueWithGoogle("/settings/security");
    expect(callback.headers.get("location")).toContain("/fr/settings/security");

    const user = await userByEmail("amina@example.com");
    expect(user).toMatchObject({ emailVerified: true, name: "Amina Benali" });
    const [profile] = await db().select().from(schema.profiles).where(eq(schema.profiles.userId, user!.id));
    expect(profile?.locale).toBe("ar");
    expect(await db().select().from(schema.consents).where(eq(schema.consents.userId, user!.id))).toHaveLength(2);
    expect(await auditActions(user!.id)).toContain("auth.signup");
    expect((await getSession())?.user.email).toBe("amina@example.com");
  });

  it("links Google to an existing confirmed account with the same email", async () => {
    await signUpAndVerify();
    await continueWithGoogle();

    const users = await db().select().from(schema.user);
    expect(users).toHaveLength(1);
    const providers = (await db().select({ provider: schema.account.providerId }).from(schema.account)).map(
      (a) => a.provider,
    );
    expect(providers.sort()).toEqual(["credential", "google"]);
    expect((await getSession())?.user.email).toBe("amina@example.com");
  });

  it("never links to an account whose email isn't confirmed (no takeover by pre-registration)", async () => {
    await authActions.signUp({
      name: "Attacker",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    const { callback } = await continueWithGoogle();

    expect(callback.headers.get("location")).toMatch(/\/fr\/login\?error=/);
    expect(await db().select().from(schema.account).where(eq(schema.account.providerId, "google"))).toHaveLength(0);
    expect(await getSession()).toBeNull();
  });

  it("won't sign in a Google account whose email Google hasn't verified", async () => {
    googleAccount.email_verified = false;
    await signUpAndVerify();
    await continueWithGoogle();
    expect(await db().select().from(schema.account).where(eq(schema.account.providerId, "google"))).toHaveLength(0);
  });
});

describe("suspension", () => {
  async function suspend(email: string) {
    await db().update(schema.user).set({ banned: true }).where(eq(schema.user.email, email));
  }

  it("blocks password log-in with a clear status", async () => {
    await signUpAndVerify();
    await suspend("amina@example.com");
    expect(await authActions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" })).toEqual({
      data: { status: "suspended" },
    });
  });

  it("treats an already signed-in suspended account as signed out", async () => {
    await signUpAndVerify();
    await logIn();
    await suspend("amina@example.com");
    expect(await getSession()).toBeNull();
  });

  it("sends a suspended Google account back to log in", async () => {
    await signUpAndVerify();
    await suspend("amina@example.com");
    const { callback } = await continueWithGoogle();
    expect(callback.headers.get("location")).toMatch(/\/fr\/login\?error=/);
    expect(await getSession()).toBeNull();
  });
});

describe("admin role", () => {
  const whoIsAdmin = adminAction
    .metadata({ actionName: "whoIsAdmin" })
    .inputSchema(z.object({}))
    .action(async ({ ctx }) => ({ id: ctx.user.id }));

  function setAdmin(...args: string[]) {
    return execFileSync(
      "pnpm",
      ["exec", "tsx", "--tsconfig", "scripts/tsconfig.json", "scripts/set-admin.ts", ...args],
      {
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        encoding: "utf8",
        shell: true,
      },
    );
  }

  it("lets only admins through adminAction", async () => {
    expect(await whoIsAdmin({})).toEqual({ serverError: "unauthorized" });
    await signUpAndVerify();
    await logIn();
    expect(await whoIsAdmin({})).toEqual({ serverError: "forbidden" });
  });

  it("is granted and revoked by `pnpm admin:set`, with audit entries", async () => {
    await signUpAndVerify();
    expect(setAdmin("Amina@Example.com")).toContain("is now an admin");
    const user = await userByEmail("amina@example.com");
    expect(user?.role).toBe("admin");

    await logIn();
    expect((await whoIsAdmin({})).data).toEqual({ id: user!.id });

    expect(setAdmin("amina@example.com", "--revoke")).toContain("no longer an admin");
    expect((await userByEmail("amina@example.com"))?.role).toBe("user");
    const audits = await db()
      .select({ action: schema.auditLog.action, targetId: schema.auditLog.targetId })
      .from(schema.auditLog);
    expect(audits).toEqual(
      expect.arrayContaining([
        { action: "admin.role_granted", targetId: user!.id },
        { action: "admin.role_revoked", targetId: user!.id },
      ]),
    );
  });
});
