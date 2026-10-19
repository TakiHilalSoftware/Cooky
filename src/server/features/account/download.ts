import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/server/env";

// Signed, expiring download links for data exports (ARCHITECTURE §1:
// downloads/[id]). The link alone isn't enough: the route also requires the
// owner's session.

function signature(id: string, expiresAt: number): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET ?? "cooky-dev")
    .update(`export:${id}:${expiresAt}`)
    .digest("base64url");
}

export function signedDownloadPath(id: string, expiresAt: Date): string {
  const e = expiresAt.getTime();
  return `/api/downloads/${id}?e=${e}&s=${signature(id, e)}`;
}

/** True when the link was made by us for this export and hasn't expired. */
export function verifyDownload(id: string, e: string | null, s: string | null, now = Date.now()): boolean {
  if (!e || !s || !/^\d{13}$/.test(e)) return false;
  const expiresAt = Number(e);
  if (expiresAt < now) return false;
  const expected = Buffer.from(signature(id, expiresAt));
  const given = Buffer.from(s);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
