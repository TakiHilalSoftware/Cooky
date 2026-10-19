import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { account, dataExports } from "@/server/db/schema";

import { signedDownloadPath } from "./download";
import type { YourDataDto } from "./dto";

/** Settings → Your data: the latest export and how account deletion is confirmed. */
export const getYourData = cache(async (now = new Date()): Promise<YourDataDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const db = getDb();
  const [[latest], [credential]] = await Promise.all([
    db
      .select()
      .from(dataExports)
      .where(eq(dataExports.userId, session.user.id))
      .orderBy(desc(dataExports.createdAt))
      .limit(1),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")))
      .limit(1),
  ]);
  const expired = latest?.status === "ready" && latest.expiresAt !== null && latest.expiresAt < now;
  return {
    export: latest
      ? {
          status: expired ? "expired" : latest.status,
          requestedAt: latest.createdAt.toISOString(),
          expiresAt: latest.expiresAt?.toISOString() ?? null,
          sizeBytes: latest.sizeBytes,
          downloadPath:
            latest.status === "ready" && !expired && latest.expiresAt
              ? signedDownloadPath(latest.id, latest.expiresAt)
              : null,
        }
      : null,
    hasPassword: Boolean(credential),
  };
});
