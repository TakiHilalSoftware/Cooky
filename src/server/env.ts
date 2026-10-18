import "server-only";

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Deployed builds (Vercel preview/production) must have every required
 * variable, so a misconfigured deploy fails at build/boot instead of at the
 * first request. Local `pnpm build` stays usable without third-party accounts;
 * set COOKY_STRICT_ENV=1 to rehearse the deployed behaviour locally.
 */
export function isStrictEnv(source: Record<string, string | undefined> = process.env): boolean {
  return source.COOKY_STRICT_ENV === "1" || source.VERCEL_ENV === "production" || source.VERCEL_ENV === "preview";
}

const strict = isStrictEnv();

function required<T extends z.ZodType>(schema: T) {
  return strict ? schema : schema.optional();
}

/**
 * The complete allow-list of variables that may reach the browser
 * (docs/SETUP_KEYS.md, "Client variables"). Adding one needs a written reason.
 */
export const clientSchema = {
  // Every email, OAuth and Stripe return link is built from this, never from the request.
  NEXT_PUBLIC_APP_URL: strict ? z.url() : z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_PUSHER_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Pusher cluster must be a plain id such as 'eu'")
    .optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
} as const;

/** Server variables used so far. Later phases add theirs as they ship. */
export const serverSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: required(z.url()),
  DATABASE_URL_UNPOOLED: required(z.url()),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),

  // Auth (docs/SETUP_KEYS.md §2). The secret signs cookies and tokens: never rotate casually.
  BETTER_AUTH_SECRET: required(z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters")),
  BETTER_AUTH_URL: strict ? z.url() : z.url().default("http://localhost:3000"),
  CRON_SECRET: required(z.string().min(32)),
  GOOGLE_CLIENT_ID: required(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: required(z.string().min(1)),
  // Apple stays optional everywhere: it needs the paid developer programme.
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_CLIENT_SECRET: z.string().min(1).optional(),

  // Email (§7). Without a key, development logs the email instead of sending it.
  RESEND_API_KEY: required(z.string().startsWith("re_")),
  EMAIL_FROM: required(z.string().min(3)),

  // Upstash (§5, §6): burst limits and the outbox drain schedule.
  UPSTASH_REDIS_REST_URL: required(z.url()),
  UPSTASH_REDIS_REST_TOKEN: required(z.string().min(1)),
  QSTASH_TOKEN: required(z.string().min(1)),
  QSTASH_CURRENT_SIGNING_KEY: required(z.string().min(1)),
  QSTASH_NEXT_SIGNING_KEY: required(z.string().min(1)),
} as const;

export const env = createEnv({
  server: serverSchema,
  client: clientSchema,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: true,
});
