import "server-only";

import { cache } from "react";

import { auth } from "./auth";
import { authRequestHeaders } from "./request-headers";

/**
 * The current session, validated against the database once per request
 * (ARCHITECTURE §5.4). Accounts that are suspended (banned) or pending
 * deletion count as signed out everywhere.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await authRequestHeaders() });
  if (!session || session.user.status !== "active" || session.user.banned === true) return null;
  return session;
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export function isAdmin(session: Session): boolean {
  return session.user.role === "admin";
}
