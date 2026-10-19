import "server-only";

import { passkey } from "@better-auth/passkey";
import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { twoFactor } from "better-auth/plugins/two-factor";
import { v7 as uuidv7 } from "uuid";

import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { env } from "@/server/env";
import { drainSoon, enqueue } from "@/server/outbox/enqueue";

import { createAccountRecords } from "./account-records";
import { clearFailedLogins, lockedUntil, recordFailedLogin } from "./lockout";
import { clientIp } from "./request-info";

const DAY = 60 * 60 * 24;

/**
 * Social providers that are configured. Google is required in deployed builds;
 * Apple is optional (it needs the paid developer programme). The log-in and
 * sign-up pages only show buttons for these.
 */
export const SOCIAL_PROVIDERS = [
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? (["google"] as const) : []),
  ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET ? (["apple"] as const) : []),
];
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
const SIGN_IN_EMAIL = "/sign-in/email";

/** The email a sign-in request is about, normalised like Better Auth does. */
function signInEmail(body: unknown): string | null {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.length > 0 ? email.trim().toLowerCase() : null;
}

export const auth = betterAuth({
  appName: "Cooky",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL],
  database: drizzleAdapter(getDb(), { provider: "pg", schema, transaction: true }),

  user: {
    additionalFields: {
      // Account lifecycle (ARCHITECTURE §4.1). Never settable from sign-up input.
      status: { type: ["active", "pending_deletion"], required: true, defaultValue: "active", input: false },
      deletionRequestedAt: { type: "date", required: false, input: false },
    },
  },

  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}),
    ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
      ? { apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET } }
      : {}),
  },

  // PRD §3.1: accounts are linked by verified email. Better Auth only links when
  // the provider verified the address and the existing account verified it too,
  // so nobody can pre-register someone else's email and inherit their Google login.
  account: {
    accountLinking: { enabled: true },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60, // PRD §3.1: 1 h reset link
    revokeSessionsOnPasswordReset: true,
    // Not awaited beyond the outbox insert: delivery timing never reveals whether an account exists.
    sendResetPassword: async ({ user, url }) => {
      await enqueue(getDb(), {
        kind: "email",
        payload: { template: "resetPassword", userId: user.id, to: user.email, url },
      });
      drainSoon();
    },
    onPasswordReset: async ({ user }, request) => {
      await clearFailedLogins(user.email);
      await audit(getDb(), { actorId: user.id, action: "auth.password_reset", ip: clientIp(request) });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: DAY, // PRD §3.1: 24 h verification link
    sendVerificationEmail: async ({ user, url }) => {
      await enqueue(getDb(), {
        kind: "email",
        payload: { template: "verifyEmail", userId: user.id, to: user.email, url },
      });
      drainSoon();
    },
    afterEmailVerification: async (user, request) => {
      await audit(getDb(), { actorId: user.id, action: "auth.email_verified", ip: clientIp(request) });
    },
  },

  session: {
    expiresIn: 30 * DAY,
    updateAge: DAY,
  },

  rateLimit: {
    // Production only, as Better Auth itself defaults: testing auth flows locally
    // shouldn't lock you out. The Upstash burst limits in our actions still apply.
    enabled: env.NODE_ENV === "production",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 5 * 60, max: 3 },
    },
  },

  advanced: {
    cookiePrefix: "cooky",
    database: { generateId: () => uuidv7() },
  },

  // Progressive lockout on the password sign-in route itself, so it guards both
  // our signIn action and direct calls to /api/auth/sign-in/email.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_EMAIL) return;
      const email = signInEmail(ctx.body);
      if (email && (await lockedUntil(email))) {
        throw new APIError("TOO_MANY_REQUESTS", { code: "ACCOUNT_LOCKED", message: "Too many failed attempts." });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_EMAIL) return;
      const email = signInEmail(ctx.body);
      if (!email) return;
      const returned = ctx.context.returned;
      if (!isAPIError(returned)) return clearFailedLogins(email);
      const code = (returned.body as { code?: unknown } | undefined)?.code;
      if (code === "INVALID_EMAIL_OR_PASSWORD") await recordFailedLogin(email);
    }),
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          await createAccountRecords(user, context?.request?.headers ?? context?.headers ?? null);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await audit(getDb(), {
            actorId: session.userId,
            // With 2FA on, this session is replaced once the code is verified.
            action: "auth.session_created",
            targetType: "session",
            targetId: session.id,
            ip: session.ipAddress,
          });
          // PRD §3.1: logging in during the 7-day grace cancels a scheduled deletion.
          const restored = await getDb()
            .update(schema.user)
            .set({ status: "active", deletionRequestedAt: null })
            .where(and(eq(schema.user.id, session.userId), eq(schema.user.status, "pending_deletion")))
            .returning({ id: schema.user.id });
          if (restored.length > 0) {
            await audit(getDb(), {
              actorId: session.userId,
              action: "account.deletion_cancelled",
              ip: session.ipAddress,
            });
          }
        },
      },
      delete: {
        after: async (session) => {
          await audit(getDb(), {
            actorId: session.userId,
            action: "auth.session_ended",
            targetType: "session",
            targetId: session.id,
          });
        },
      },
    },
  },

  plugins: [
    haveIBeenPwned(),
    twoFactor({
      issuer: "Cooky",
      // Code guessing is locked out by the plugin itself.
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
      backupCodeOptions: { amount: 10, length: 10 },
    }),
    // Roles and suspension (ban). Suspended accounts can't sign in, and their
    // sessions are revoked when the ban is applied.
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    passkey({
      rpID: new URL(env.BETTER_AUTH_URL).hostname,
      rpName: "Cooky",
      origin: env.BETTER_AUTH_URL,
    }),
    // Must stay last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
