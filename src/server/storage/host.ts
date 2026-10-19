import "server-only";

import { env } from "@/server/env";

/**
 * The host signed photo URLs point at, for the CSP `img-src`. Kept apart from
 * the R2 client so the proxy doesn't bundle the S3 SDK.
 */
export function storageImageHost(): string | null {
  return env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null;
}
