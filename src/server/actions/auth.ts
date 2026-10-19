"use server";

import { returnServerError } from "next-safe-action";
import { authRequestHeaders } from "@/server/auth/request-headers";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";

import { redirect } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/errors";
import { auth, SOCIAL_PROVIDERS } from "@/server/auth/auth";
import { authErrorCode } from "@/server/auth/errors";
import { lockedUntil } from "@/server/auth/lockout";
import type {
  EmailSentResult,
  ResetPasswordResult,
  SignInResult,
  SignUpResult,
  SocialSignInResult,
} from "@/server/features/auth/dto";
import {
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  socialSignInSchema,
} from "@/server/features/auth/schema";
import type { PasskeyLoginResult, TwoFactorCodeResult } from "@/server/features/security/dto";
import { backupCodeSignInSchema, passkeyLoginSchema, twoFactorSignInSchema } from "@/server/features/security/schema";

import { enforceBurst, publicAction, userAction } from "./_clients";

/** Where email links land; Better Auth appends `?error=` on failure. */
const verifiedPath = (locale: string) => `/${locale}/verify-email/done`;

export const signUp = publicAction
  .metadata({ actionName: "signUp" })
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<SignUpResult> => {
    await enforceBurst("signupIp", ctx.ip);
    try {
      await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          callbackURL: verifiedPath(input.locale),
        },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "PASSWORD_COMPROMISED") return { status: "password_compromised" };
      if (code === "RATE_LIMITED") returnServerError<ActionErrorCode>("rate_limited");
      if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") returnServerError<ActionErrorCode>("invalid");
      throw error;
    }
    return { status: "check_email" };
  });

export const signIn = publicAction
  .metadata({ actionName: "signIn" })
  .inputSchema(signInSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<SignInResult> => {
    await enforceBurst("signInIp", ctx.ip);
    await enforceBurst("signInAccount", input.email);
    let result: unknown;
    try {
      result = await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
          rememberMe: true,
          callbackURL: verifiedPath(input.locale),
        },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "INVALID_EMAIL_OR_PASSWORD") return { status: "invalid_credentials" };
      if (code === "EMAIL_NOT_VERIFIED") return { status: "verify_email" };
      if (code === "BANNED_USER") return { status: "suspended" };
      if (code === "ACCOUNT_LOCKED") {
        const until = await lockedUntil(input.email);
        return { status: "locked", retryAt: until?.toISOString() ?? null };
      }
      if (code === "RATE_LIMITED") returnServerError<ActionErrorCode>("rate_limited");
      throw error;
    }
    // Password was right but the account has 2FA: continue on the code step.
    if ((result as { twoFactorRedirect?: unknown } | null)?.twoFactorRedirect === true) {
      const query = input.next ? `?next=${encodeURIComponent(input.next)}` : "";
      return redirect({ href: `/two-factor${query}`, locale: input.locale });
    }
    // `next` is validated as an internal path by the schema.
    return redirect({ href: input.next ?? HOME_AFTER_SIGN_IN, locale: input.locale });
  });

export const signOut = userAction.metadata({ actionName: "signOut" }).action(async () => {
  await auth.api.signOut({ headers: await authRequestHeaders() });
});

export const resendVerification = publicAction
  .metadata({ actionName: "resendVerification" })
  .inputSchema(emailOnlySchema)
  .action(async ({ parsedInput: input, ctx }): Promise<EmailSentResult> => {
    await enforceBurst("authEmailIp", ctx.ip);
    try {
      await auth.api.sendVerificationEmail({ body: { email: input.email, callbackURL: verifiedPath(input.locale) } });
    } catch (error) {
      // Unknown or already-verified emails get the same answer: no account enumeration.
      if (authErrorCode(error) === null) throw error;
    }
    return { status: "sent" };
  });

export const requestPasswordReset = publicAction
  .metadata({ actionName: "requestPasswordReset" })
  .inputSchema(emailOnlySchema)
  .action(async ({ parsedInput: input, ctx }): Promise<EmailSentResult> => {
    await enforceBurst("authEmailIp", ctx.ip);
    await auth.api.requestPasswordReset({
      body: { email: input.email, redirectTo: `/${input.locale}/reset-password` },
    });
    return { status: "sent" };
  });

export const resetPassword = publicAction
  .metadata({ actionName: "resetPassword" })
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<ResetPasswordResult> => {
    await enforceBurst("authEmailIp", ctx.ip);
    try {
      await auth.api.resetPassword({ body: { newPassword: input.password, token: input.token } });
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "INVALID_TOKEN") return { status: "invalid_token" };
      if (code === "PASSWORD_COMPROMISED") return { status: "password_compromised" };
      throw error;
    }
    return { status: "reset" };
  });

/** Maps the 2FA plugin's failures during sign-in to what the code page explains. */
function twoFactorFailure(error: unknown): TwoFactorCodeResult {
  const code = authErrorCode(error);
  if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE") return { status: "invalid_code" };
  if (code === "INVALID_TWO_FACTOR_COOKIE") return { status: "expired" };
  if (
    code === "ACCOUNT_TEMPORARILY_LOCKED" ||
    code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" ||
    code === "RATE_LIMITED"
  ) {
    return { status: "locked" };
  }
  throw error;
}

/** Second step of signing in: the 6-digit code from the authenticator app. */
export const verifyTwoFactorCode = publicAction
  .metadata({ actionName: "verifyTwoFactorCode" })
  .inputSchema(twoFactorSignInSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<TwoFactorCodeResult> => {
    await enforceBurst("signInIp", ctx.ip);
    try {
      await auth.api.verifyTOTP({
        body: { code: input.code, trustDevice: input.trustDevice },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      return twoFactorFailure(error);
    }
    return redirect({ href: input.next ?? HOME_AFTER_SIGN_IN, locale: input.locale });
  });

/** Second step of signing in when the phone isn't at hand: a one-time backup code. */
export const verifyBackupCode = publicAction
  .metadata({ actionName: "verifyBackupCode" })
  .inputSchema(backupCodeSignInSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<TwoFactorCodeResult> => {
    await enforceBurst("signInIp", ctx.ip);
    try {
      await auth.api.verifyBackupCode({ body: { code: input.code }, headers: await authRequestHeaders() });
    } catch (error) {
      return twoFactorFailure(error);
    }
    return redirect({ href: input.next ?? HOME_AFTER_SIGN_IN, locale: input.locale });
  });

/** Step 1 of passkey sign-in: options for the browser's passkey prompt. */
export const passkeyLoginOptions = publicAction
  .metadata({ actionName: "passkeyLoginOptions" })
  .action(async ({ ctx }) => {
    await enforceBurst("signInIp", ctx.ip);
    return auth.api.generatePasskeyAuthenticationOptions({ headers: await authRequestHeaders() });
  });

/** Step 2: verifies the passkey and signs in (a passkey already counts as two factors). */
export const passkeyLogin = publicAction
  .metadata({ actionName: "passkeyLogin" })
  .inputSchema(passkeyLoginSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<PasskeyLoginResult> => {
    await enforceBurst("signInIp", ctx.ip);
    try {
      await auth.api.verifyPasskeyAuthentication({
        body: { response: input.response },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      if (authErrorCode(error) !== null) return { status: "not_recognised" };
      throw error;
    }
    return redirect({ href: input.next ?? HOME_AFTER_SIGN_IN, locale: input.locale });
  });

/**
 * "Continue with Google/Apple": returns the provider's sign-in URL. Better
 * Auth keeps the OAuth state in a cookie; the provider sends the person back
 * to /api/auth/callback/<provider>, which signs them in (or creates the
 * account, linked by verified email) and redirects to `next`.
 */
export const startSocialSignIn = publicAction
  .metadata({ actionName: "startSocialSignIn" })
  .inputSchema(socialSignInSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<SocialSignInResult> => {
    await enforceBurst("signInIp", ctx.ip);
    const configured: readonly string[] = SOCIAL_PROVIDERS;
    if (!configured.includes(input.provider)) returnServerError<ActionErrorCode>("unavailable");
    const result = await auth.api.signInSocial({
      body: {
        provider: input.provider,
        callbackURL: `/${input.locale}${input.next ?? HOME_AFTER_SIGN_IN}`,
        errorCallbackURL: `/${input.locale}/login`,
        disableRedirect: true,
      },
      headers: await authRequestHeaders(),
    });
    if (!result.url) returnServerError<ActionErrorCode>("unavailable");
    return { url: result.url };
  });
