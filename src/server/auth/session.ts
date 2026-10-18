import "server-only";

import { authRequestHeaders } from "@/server/auth/request-headers";
import { cache } from "react";

import { auth } from "./auth";

/**
 * The current session, validated against the database once per request
 * (ARCHITECTURE §5.4). Accounts that are banned or pending deletion count as
 * signed out everywhere.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await authRequestHeaders() });
  if (!session || session.user.status !== "active") return null;
  return session;
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
