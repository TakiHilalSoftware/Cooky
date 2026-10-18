import "server-only";

import { cookies, headers } from "next/headers";

/**
 * Request headers for Better Auth calls, with the Cookie header rebuilt from
 * the live cookie store. Inside a Server Action, Better Auth may replace the
 * session (enabling 2FA, changing the password) and set the new cookie with
 * `cookies().set`; `headers()` still holds the cookie the request arrived
 * with, so reading the session from it would see a deleted session and treat
 * the person as signed out mid-flow.
 */
export async function authRequestHeaders(): Promise<Headers> {
  const [incoming, jar] = await Promise.all([headers(), cookies()]);
  const merged = new Headers(incoming);
  const cookie = jar.toString();
  if (cookie) merged.set("cookie", cookie);
  else merged.delete("cookie");
  return merged;
}
