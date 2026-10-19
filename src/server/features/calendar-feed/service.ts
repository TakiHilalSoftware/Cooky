import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** A new secret for a feed URL: 32 random bytes, URL-safe. Only its hash is stored. */
export function newFeedToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashFeedToken(token) };
}

export function hashFeedToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Only well-formed tokens are looked up (43 base64url characters). */
export const FEED_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
