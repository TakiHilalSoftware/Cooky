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
 * Free mailbox providers. Email can only be sent "from" a domain verified in
 * Resend, and nobody can verify these (docs/SETUP_KEYS.md §7).
 */
const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "hotmail.com",
  "hotmail.fr",
  "live.com",
  "live.fr",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.fr",
  "gmx.de",
  "mail.com",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "laposte.net",
  "sfr.fr",
  "yandex.com",
  "zoho.com",
]);

/** The address part of "Name <addr>" or "addr", or null when malformed. */
export function senderAddress(value: string): string | null {
  const address = (value.match(/<([^<>]+)>\s*$/)?.[1] ?? value).trim().toLowerCase();
  return z.email().safeParse(address).success ? address : null;
}

/** Why this sender can't work with Resend, or null when it's fine. */
export function emailFromProblem(value: string): string | null {
  const address = senderAddress(value);
  if (!address) return `EMAIL_FROM must look like "Cooky <hello@yourdomain.com>" or "hello@yourdomain.com".`;
  const domain = address.split("@")[1] ?? "";
  if (!PUBLIC_MAIL_DOMAINS.has(domain)) return null;
  return (
    `EMAIL_FROM can't use ${domain}: Resend only sends from domains you verify, and public mail domains can't be verified. ` +
    `For testing use "Cooky <onboarding@resend.dev>" (delivers only to your Resend account's own email), or verify your own domain in Resend.`
  );
}

/**
 * Deployed builds refuse a sender Resend will reject: without email nobody can
 * confirm an account or reset a password. Locally only email is affected, so
 * the app still boots and sendEmail explains the problem instead
 * (docs/SETUP_KEYS.md: optional features turn off cleanly, never an error).
 */
const emailFrom = strict
  ? z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        const problem = emailFromProblem(value);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      })
  : z.string().trim().optional();

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
  EMAIL_FROM: emailFrom,

  // Stripe (§4). Test-mode keys locally; the webhook secret comes from `pnpm stripe:listen`.
  STRIPE_SECRET_KEY: required(z.string().regex(/^(sk|rk)_(test|live)_/)),
  STRIPE_WEBHOOK_SECRET: required(z.string().startsWith("whsec_")),
  // Stripe Tax (PRD §3.7) needs the business address set in the dashboard first.
  STRIPE_AUTOMATIC_TAX: z.enum(["on", "off"]).default("off"),

  // Upstash (§5, §6): burst limits and the outbox drain schedule.
  UPSTASH_REDIS_REST_URL: required(z.url()),
  UPSTASH_REDIS_REST_TOKEN: required(z.string().min(1)),
  QSTASH_TOKEN: required(z.string().min(1)),
  QSTASH_CURRENT_SIGNING_KEY: required(z.string().min(1)),
  QSTASH_NEXT_SIGNING_KEY: required(z.string().min(1)),

  // AI (§8): Groq first, OpenAI as the fallback. Optional: without them, voice
  // dictation and the Assistant say they're unavailable and give the try back.
  GROQ_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_TRANSCRIBE_MODEL: z.string().min(1).default("whisper-large-v3-turbo"),
  // Groq retires models: check its model list (docs/SETUP_KEYS.md §11) and override here.
  AI_CHAT_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),
  AI_FALLBACK_MODEL: z.string().min(1).default("gpt-4.1-mini"),

  // Cloudflare R2 (§8): dish and profile photos in a private bucket, read through signed URLs.
  // Optional even when deployed (the go-live checklist requires it): without all four, photo
  // uploads say they're off and everything else works, so a preview never fails to boot over it.
  R2_ACCOUNT_ID: z
    .string()
    .regex(/^[a-f0-9]{32}$/, "R2_ACCOUNT_ID is the 32-character id from the R2 dashboard")
    .optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "R2_BUCKET must be a bucket name such as cooky-photos")
    .optional(),

  // Pusher (§9) and Web Push (§10). Optional like R2 (the go-live checklist requires them):
  // without Pusher, open chats refresh on a short timer; without VAPID, push is off and
  // Settings says so. Everything else in Social works either way.
  PUSHER_APP_ID: z.string().min(1).optional(),
  PUSHER_SECRET: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/, "VAPID_SUBJECT must be mailto:you@yourdomain or an https URL")
    .optional(),

  // Open-Meteo (§12): the commercial key. Without it, development uses the free
  // (non-commercial) endpoint and deployed builds hide the weather chip.
  OPEN_METEO_API_KEY: z.string().min(1).optional(),
  // "1" lets a deployed build use the free endpoint too: for a non-commercial
  // deployment (a demo) only. Remove it once the app takes payments.
  OPEN_METEO_FREE_TIER: z.literal("1").optional(),
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
