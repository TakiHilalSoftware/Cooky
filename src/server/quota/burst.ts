import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

/** Named burst rules (AGENT_RULES §3.5). Keys are prefixed per rule. */
export const BURST_RULES = {
  // PRD §3.1: signup throttled per IP.
  signupIp: { tokens: 5, window: "1 h" },
  // Login attempts per IP and per account (Better Auth adds its own on the HTTP route).
  signInIp: { tokens: 20, window: "15 m" },
  signInAccount: { tokens: 8, window: "15 m" },
  // Emails we send on request: verification resends and reset links.
  authEmailIp: { tokens: 6, window: "1 h" },
  // PRD §3.1: change password, 5 per 15 min.
  changePassword: { tokens: 5, window: "15 m" },
  // Default for signed-in writes.
  userWrite: { tokens: 60, window: "1 m" },
  // Signed-in reads that fire while typing (autocomplete): roomy, but still bounded.
  userRead: { tokens: 300, window: "1 m" },
} as const satisfies Record<string, { tokens: number; window: `${number} ${"s" | "m" | "h"}` }>;

export type BurstRule = keyof typeof BURST_RULES;

const limiters = new Map<BurstRule, Ratelimit>();
let redis: Redis | undefined;
let warned = false;

/**
 * True when the caller is under the rule's limit. Limits apply in production
 * only (matching Better Auth's own rate limiter), so testing flows locally
 * never locks you out; outside production every call is allowed and a note is
 * logged once. Deployed builds also require Upstash to be configured.
 */
export async function withinBurstLimit(rule: BurstRule, key: string): Promise<boolean> {
  if (env.NODE_ENV !== "production" || !env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) logger.info({ nodeEnv: env.NODE_ENV }, "burst limits are off outside production");
    warned = true;
    return true;
  }
  redis ??= new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  let limiter = limiters.get(rule);
  if (!limiter) {
    const { tokens, window } = BURST_RULES[rule];
    limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(tokens, window), prefix: `cooky:rl:${rule}` });
    limiters.set(rule, limiter);
  }
  const { success } = await limiter.limit(key);
  return success;
}
