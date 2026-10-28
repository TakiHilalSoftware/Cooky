import { expect } from "vitest";

import * as actions from "@/server/actions/auth";
import { auth } from "@/server/auth/auth";

import { browser } from "./browser";
import { latestEmailJob } from "./db";

export const PASSWORD = "correct horse battery staple";
export const NEW_PASSWORD = "a brand new kitchen password";

/** Follows an emailed link through Better Auth's route handler, like a browser click. */
export async function openEmailLink(url: string) {
  const response = await auth.handler(new Request(url, { headers: browser.requestHeaders() }));
  browser.absorb(response);
  return response;
}

/** A confirmed account, signed out. */
export async function signUpAndVerify(email = "amina@example.com", password = PASSWORD) {
  await actions.signUp({ name: "Amina Benali", email, password, acceptTerms: true, locale: "fr" });
  const job = await latestEmailJob();
  await openEmailLink(job!.payload.url!);
  browser.reset();
}

/** Server Actions that redirect throw Next's navigation signal; this unwraps it. */
export async function expectRedirect(promise: Promise<unknown>, to: string) {
  await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining(to) });
}

/** Logs in through the real action (expects success, i.e. a redirect). */
export async function logIn(email = "amina@example.com", password = PASSWORD) {
  await expectRedirect(actions.signIn({ email, password, locale: "en" }), "/en/cook");
}
