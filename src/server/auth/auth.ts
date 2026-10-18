import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { v7 as uuidv7 } from "uuid";

import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { env } from "@/server/env";
import { drainSoon, enqueue } from "@/server/outbox/enqueue";

import { createAccountRecords } from "./account-records";
import { clientIp } from "./request-info";

const DAY = 60 * 60 * 24;

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
    enabled: true,
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
            action: "auth.login",
            targetType: "session",
            targetId: session.id,
            ip: session.ipAddress,
          });
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
    // Must stay last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
