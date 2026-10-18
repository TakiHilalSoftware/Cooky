import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSIONS } from "@config/legal";

import { browser } from "./support/browser";
import { auditActions, db, latestEmailJob, resetData, userByEmail } from "./support/db";
import { BREACHED_PASSWORD, hibp } from "./support/hibp";

// Email delivery is observed through the outbox; the real send is replaced so
// tests can make the provider fail on purpose.
const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const { auth } = await import("@/server/auth/auth");
const { getSession } = await import("@/server/auth/session");
const actions = await import("@/server/actions/auth");
const { drainOutbox, MAX_ATTEMPTS } = await import("@/server/outbox/drain");
const { PermanentJobError } = await import("@/server/outbox/errors");
const schema = await import("@/server/db/schema");

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a brand new kitchen password";

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  browser.headers.set("accept-language", "fr-FR,fr;q=0.9");
  sendEmail.mockReset().mockResolvedValue(undefined);
});

/** Follows an emailed link through Better Auth's route handler, like a browser click. */
async function openEmailLink(url: string) {
  const response = await auth.handler(new Request(url, { headers: browser.requestHeaders() }));
  browser.absorb(response);
  return response;
}

async function signUpAndVerify(email = "amina@example.com") {
  await actions.signUp({ name: "Amina Benali", email, password: PASSWORD, acceptTerms: true, locale: "fr" });
  const job = await latestEmailJob();
  await openEmailLink(job!.payload.url!);
  browser.reset();
}

/** Server Actions that redirect throw Next's navigation signal; this unwraps it. */
async function expectRedirect(promise: Promise<unknown>, to: string) {
  await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining(to) });
}

describe("sign up", () => {
  it("creates an unverified account with profile, consents, audit entry and a confirmation email", async () => {
    browser.cookies.set("NEXT_LOCALE", "ar");
    const result = await actions.signUp({
      name: "  Amina Benali ",
      email: "Amina@Example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "ar",
    });
    expect(result).toEqual({ data: { status: "check_email" } });

    const user = await userByEmail("amina@example.com");
    expect(user).toMatchObject({ name: "Amina Benali", emailVerified: false, status: "active" });

    const [profile] = await db().select().from(schema.profiles).where(eq(schema.profiles.userId, user!.id));
    expect(profile).toMatchObject({ displayName: "Amina Benali", locale: "ar", accent: "default" });

    const consents = await db().select().from(schema.consents).where(eq(schema.consents.userId, user!.id));
    expect(consents.map((c) => [c.document, c.version]).sort()).toEqual([
      ["privacy", LEGAL_VERSIONS.privacy],
      ["terms", LEGAL_VERSIONS.terms],
    ]);

    expect(await auditActions(user!.id)).toContain("auth.signup");
    const job = await latestEmailJob();
    expect(job?.payload).toMatchObject({ template: "verifyEmail", to: "amina@example.com", userId: user!.id });
    expect(job?.payload.url).toContain("/api/auth/verify-email?token=");

    // Nobody is signed in until the email is confirmed.
    expect(browser.cookies.size).toBe(1);
  });

  it("answers the same way for an email that's already registered (no account enumeration)", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    const again = await actions.signUp({
      name: "Someone else",
      email: "amina@example.com",
      password: "another long password",
      acceptTerms: true,
      locale: "en",
    });
    expect(again).toEqual({ data: { status: "check_email" } });
    expect(await db().select().from(schema.user)).toHaveLength(1);
  });

  it("refuses a password found in a data breach and creates nothing", async () => {
    const result = await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: BREACHED_PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    expect(result).toEqual({ data: { status: "password_compromised" } });
    expect(await userByEmail("amina@example.com")).toBeUndefined();
  });

  it("refuses sign-up without consent at the server, whatever the form did", async () => {
    const result = await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      // @ts-expect-error: the client can send anything; the schema must reject it.
      acceptTerms: false,
      locale: "en",
    });
    expect(result.validationErrors).toBeDefined();
    expect(await userByEmail("amina@example.com")).toBeUndefined();
  });
});

describe("email confirmation and log in", () => {
  it("won't log in an unverified account, and sends a fresh link instead", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    const before = (await db().select().from(schema.outbox)).length;

    const result = await actions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" });
    expect(result).toEqual({ data: { status: "verify_email" } });
    expect((await db().select().from(schema.outbox)).length).toBe(before + 1);
    expect(await getSession()).toBeNull();
  });

  it("confirms the email from the link, signs the person in and audits it", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "fr",
    });
    const job = await latestEmailJob();

    const response = await openEmailLink(job!.payload.url!);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/fr/verify-email/done");

    const user = await userByEmail("amina@example.com");
    expect(user?.emailVerified).toBe(true);
    expect((await getSession())?.user.email).toBe("amina@example.com");
    expect(await auditActions(user!.id)).toEqual(expect.arrayContaining(["auth.email_verified", "auth.login"]));
  });

  it("sends an expired or forged link back with an error, not a session", async () => {
    const response = await openEmailLink(
      "http://localhost:3000/api/auth/verify-email?token=forged&callbackURL=%2Fen%2Fverify-email%2Fdone",
    );
    expect(response.headers.get("location")).toContain("error=");
    expect(await getSession()).toBeNull();
  });

  it("logs in a verified account and redirects to the requested page", async () => {
    await signUpAndVerify();
    await expectRedirect(
      actions.signIn({ email: "amina@example.com", password: PASSWORD, next: "/settings/security", locale: "en" }),
      "/en/settings/security",
    );
    expect((await getSession())?.user.email).toBe("amina@example.com");
  });

  it("ignores an off-site `next` and goes to Settings", async () => {
    await signUpAndVerify();
    await expectRedirect(
      actions.signIn({ email: "amina@example.com", password: PASSWORD, next: "//evil.example", locale: "en" }),
      "/en/settings",
    );
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await signUpAndVerify();
    const wrongPassword = await actions.signIn({
      email: "amina@example.com",
      password: "not my password",
      locale: "en",
    });
    const unknownEmail = await actions.signIn({ email: "nobody@example.com", password: PASSWORD, locale: "en" });
    expect(wrongPassword).toEqual({ data: { status: "invalid_credentials" } });
    expect(unknownEmail).toEqual(wrongPassword);
  });
});

describe("log out", () => {
  it("ends the session and audits it", async () => {
    await signUpAndVerify();
    await expectRedirect(
      actions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" }),
      "/en/settings",
    );
    const current = (await getSession())!;
    const userId = current.user.id;

    await expect(actions.signOut()).resolves.toEqual({});
    // Only this device's session ends; others (e.g. the one created by the email link) stay.
    expect(await db().select().from(schema.session).where(eq(schema.session.id, current.session.id))).toHaveLength(0);
    expect(await getSession()).toBeNull();
    expect(await auditActions(userId)).toContain("auth.session_ended");
  });

  it("is refused without a session", async () => {
    await expect(actions.signOut()).resolves.toEqual({ serverError: "unauthorized" });
  });
});

describe("password reset", () => {
  it("emails a link only when the account exists, but answers the same either way", async () => {
    await signUpAndVerify();
    const jobsBefore = (await db().select().from(schema.outbox)).length;

    const unknown = await actions.requestPasswordReset({ email: "nobody@example.com", locale: "en" });
    expect((await db().select().from(schema.outbox)).length).toBe(jobsBefore);

    const known = await actions.requestPasswordReset({ email: "amina@example.com", locale: "en" });
    expect(known).toEqual(unknown);
    expect((await latestEmailJob())?.payload.template).toBe("resetPassword");
  });

  it("sets the new password, signs out every device, and the old password stops working", async () => {
    await signUpAndVerify();
    await expectRedirect(
      actions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" }),
      "/en/settings",
    );
    browser.reset();

    await actions.requestPasswordReset({ email: "amina@example.com", locale: "en" });
    const link = await openEmailLink((await latestEmailJob())!.payload.url!);
    const token = new URL(link.headers.get("location")!, "http://localhost:3000").searchParams.get("token");
    expect(token).toBeTruthy();

    await expect(actions.resetPassword({ token: token!, password: NEW_PASSWORD, locale: "en" })).resolves.toEqual({
      data: { status: "reset" },
    });
    expect(await db().select().from(schema.session)).toHaveLength(0);
    expect(await actions.signIn({ email: "amina@example.com", password: PASSWORD, locale: "en" })).toEqual({
      data: { status: "invalid_credentials" },
    });
    await expectRedirect(
      actions.signIn({ email: "amina@example.com", password: NEW_PASSWORD, locale: "en" }),
      "/en/settings",
    );

    // The link works once.
    await expect(
      actions.resetPassword({ token: token!, password: "yet another password", locale: "en" }),
    ).resolves.toEqual({
      data: { status: "invalid_token" },
    });
  });
});

describe("outbox delivery", () => {
  it("delivers each email once and removes the single-use link from storage", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "fr",
    });

    expect(await drainOutbox({ limit: 10 })).toEqual({ done: 1, retried: 0, dead: 0 });
    expect(await drainOutbox({ limit: 10 })).toEqual({ done: 0, retried: 0, dead: 0 });
    expect(sendEmail).toHaveBeenCalledOnce();
    const [to, email] = sendEmail.mock.calls[0] as unknown as [string, { subject: string; text: string }];
    expect(to).toBe("amina@example.com");
    expect(email.subject).toBe("Confirmez votre e-mail pour Cooky");

    const job = await latestEmailJob();
    expect(job?.status).toBe("done");
    expect(job?.payload.url).toBeUndefined();
  });

  it("retries a failed delivery later, then gives up after the last attempt", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    sendEmail.mockRejectedValue(new Error("provider down"));

    expect(await drainOutbox({ limit: 10 })).toEqual({ done: 0, retried: 1, dead: 0 });
    let job = await latestEmailJob();
    expect(job).toMatchObject({ status: "pending", attempts: 1, lastError: "provider down" });
    expect(job!.runAfter.getTime()).toBeGreaterThan(Date.now());

    // Fast-forward: make it due again until the attempts run out.
    for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
      await db()
        .update(schema.outbox)
        .set({ runAfter: new Date(0) });
      await drainOutbox({ limit: 10 });
    }
    job = await latestEmailJob();
    expect(job).toMatchObject({ status: "dead", attempts: MAX_ATTEMPTS });
  });

  it("stops at once on a failure retrying can't fix, keeping the reason for the fix", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    sendEmail.mockRejectedValue(
      new PermanentJobError(
        "resend validation_error: The gmail.com domain is not verified. Please, add and verify your domain.",
      ),
    );

    expect(await drainOutbox({ limit: 10 })).toEqual({ done: 0, retried: 0, dead: 1 });
    expect(await latestEmailJob()).toMatchObject({
      status: "dead",
      attempts: 1,
      lastError: expect.stringContaining("gmail.com domain is not verified"),
    });
  });

  it("never sends the same job twice when two drains run at once", async () => {
    await actions.signUp({
      name: "Amina",
      email: "amina@example.com",
      password: PASSWORD,
      acceptTerms: true,
      locale: "en",
    });
    const [a, b] = await Promise.all([drainOutbox({ limit: 10 }), drainOutbox({ limit: 10 })]);
    expect(a.done + b.done).toBe(1);
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});
