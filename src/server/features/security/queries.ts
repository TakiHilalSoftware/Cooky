import "server-only";

import { and, eq } from "drizzle-orm";
import { authRequestHeaders } from "@/server/auth/request-headers";
import { cache } from "react";

import { auth } from "@/server/auth/auth";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { account } from "@/server/db/schema";

import type { DeviceDto, PasskeyDto, SecurityOverviewDto } from "./dto";
import { parseUserAgent } from "./user-agent";

/** Everything Settings → Security shows, for the signed-in viewer only. */
export const getSecurityOverview = cache(async (): Promise<SecurityOverviewDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const requestHeaders = await authRequestHeaders();

  const [sessions, passkeys, [credential]] = await Promise.all([
    auth.api.listSessions({ headers: requestHeaders }),
    auth.api.listPasskeys({ headers: requestHeaders }),
    getDb()
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")))
      .limit(1),
  ]);

  const devices: DeviceDto[] = sessions
    .map((s) => ({
      id: s.id,
      ...parseUserAgent(s.userAgent),
      current: s.id === session.session.id,
      lastActiveAt: s.updatedAt.toISOString(),
      signedInAt: s.createdAt.toISOString(),
    }))
    // This device first, then most recently active.
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.localeCompare(a.lastActiveAt));

  return {
    twoFactorEnabled: session.user.twoFactorEnabled === true,
    hasPassword: Boolean(credential),
    devices,
    passkeys: passkeys.map((p): PasskeyDto => ({
      id: p.id,
      name: p.name ?? null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      synced: p.backedUp,
    })),
  };
});
