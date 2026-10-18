"use server";

import { returnServerError } from "next-safe-action";
import { headers } from "next/headers";

import { redirect } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/errors";
import { auth } from "@/server/auth/auth";
import { authErrorCode } from "@/server/auth/errors";
import type { EmailSentResult, ResetPasswordResult, SignInResult, SignUpResult } from "@/server/features/auth/dto";
import { emailOnlySchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/server/features/auth/schema";

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
        headers: await headers(),
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
    try {
      await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
          rememberMe: true,
          callbackURL: verifiedPath(input.locale),
        },
        headers: await headers(),
      });
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "INVALID_EMAIL_OR_PASSWORD") return { status: "invalid_credentials" };
      if (code === "EMAIL_NOT_VERIFIED") return { status: "verify_email" };
      if (code === "RATE_LIMITED") returnServerError<ActionErrorCode>("rate_limited");
      throw error;
    }
    // `next` is validated as an internal path by the schema.
    return redirect({ href: input.next ?? "/settings", locale: input.locale });
  });

export const signOut = userAction.metadata({ actionName: "signOut" }).action(async () => {
  await auth.api.signOut({ headers: await headers() });
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
