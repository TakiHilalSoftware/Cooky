"use server";

import { and, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { authRequestHeaders } from "@/server/auth/request-headers";
import QRCode from "qrcode";

import type { ActionErrorCode } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { auth } from "@/server/auth/auth";
import { authErrorCode } from "@/server/auth/errors";
import { getDb } from "@/server/db/client";
import { session as sessionTable } from "@/server/db/schema";
import { env } from "@/server/env";
import type {
  BackupCodesDto,
  ChangePasswordResult,
  PasswordCheckResult,
  TwoFactorCodeResult,
  TwoFactorSetupDto,
} from "@/server/features/security/dto";
import {
  changePasswordSchema,
  confirmPasswordSchema,
  deviceSchema,
  passkeyIdSchema,
  passkeyNameSchema,
  passkeyRegisterSchema,
  totpCodeSchema,
} from "@/server/features/security/schema";
import { parseUserAgent } from "@/server/features/security/user-agent";
import { drainSoon, enqueue } from "@/server/outbox/enqueue";

import { enforceBurst, userAction } from "./_clients";

const SECURITY_PATH = "/[locale]/settings/security";

function refreshSecurity() {
  revalidatePath(SECURITY_PATH, "page");
}

export const changePassword = userAction
  .metadata({ actionName: "changePassword" })
  .inputSchema(changePasswordSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<ChangePasswordResult> => {
    await enforceBurst("changePassword", ctx.user.id);
    try {
      await auth.api.changePassword({
        // PRD §3.1: signs out every other device, keeps this one signed in.
        body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "INVALID_PASSWORD") return { status: "wrong_password" };
      if (code === "PASSWORD_COMPROMISED") return { status: "password_compromised" };
      throw error;
    }
    await getDb().transaction(async (tx) => {
      await audit(tx, { actorId: ctx.user.id, action: "auth.password_changed", ip: ctx.ip });
      // A heads-up to the inbox, so an unexpected change can be undone quickly.
      await enqueue(tx, {
        kind: "email",
        payload: {
          template: "passwordChanged",
          userId: ctx.user.id,
          to: ctx.user.email,
          url: `${env.NEXT_PUBLIC_APP_URL}/forgot-password`,
        },
      });
    });
    drainSoon();
    refreshSecurity();
    return { status: "changed" };
  });

/** Step 1 of turning on 2FA: re-check the password, then show the QR code. */
export const startTwoFactorSetup = userAction
  .metadata({ actionName: "startTwoFactorSetup" })
  .inputSchema(confirmPasswordSchema)
  .action(async ({ parsedInput: input }): Promise<TwoFactorSetupDto | PasswordCheckResult> => {
    let setup: Awaited<ReturnType<typeof auth.api.enableTwoFactor>>;
    try {
      setup = await auth.api.enableTwoFactor({
        body: { password: input.password, method: "totp" },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      if (authErrorCode(error) === "INVALID_PASSWORD") return { status: "wrong_password" };
      throw error;
    }
    if (setup.method !== "totp") throw new Error("2FA setup didn't return an authenticator secret");
    const secret = new URL(setup.totpURI).searchParams.get("secret") ?? "";
    const qrSvg = await QRCode.toString(setup.totpURI, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return { qrSvg, secret, backupCodes: setup.backupCodes };
  });

/** Step 2: the first correct code from the app switches 2FA on. */
export const confirmTwoFactorSetup = userAction
  .metadata({ actionName: "confirmTwoFactorSetup" })
  .inputSchema(totpCodeSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<{ status: "enabled" } | TwoFactorCodeResult> => {
    try {
      await auth.api.verifyTOTP({ body: { code: input.code }, headers: await authRequestHeaders() });
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "INVALID_CODE") return { status: "invalid_code" };
      if (code === "ACCOUNT_TEMPORARILY_LOCKED" || code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE")
        return { status: "locked" };
      throw error;
    }
    await audit(getDb(), { actorId: ctx.user.id, action: "auth.2fa_enabled", ip: ctx.ip });
    refreshSecurity();
    return { status: "enabled" };
  });

export const disableTwoFactor = userAction
  .metadata({ actionName: "disableTwoFactor" })
  .inputSchema(confirmPasswordSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<PasswordCheckResult> => {
    try {
      await auth.api.disableTwoFactor({ body: { password: input.password }, headers: await authRequestHeaders() });
    } catch (error) {
      if (authErrorCode(error) === "INVALID_PASSWORD") return { status: "wrong_password" };
      throw error;
    }
    await audit(getDb(), { actorId: ctx.user.id, action: "auth.2fa_disabled", ip: ctx.ip });
    refreshSecurity();
    return { status: "ok" };
  });

/** New backup codes; the old ones stop working. */
export const regenerateBackupCodes = userAction
  .metadata({ actionName: "regenerateBackupCodes" })
  .inputSchema(confirmPasswordSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<BackupCodesDto | PasswordCheckResult> => {
    let result: { backupCodes: string[] };
    try {
      result = await auth.api.generateBackupCodes({
        body: { password: input.password },
        headers: await authRequestHeaders(),
      });
    } catch (error) {
      if (authErrorCode(error) === "INVALID_PASSWORD") return { status: "wrong_password" };
      throw error;
    }
    await audit(getDb(), { actorId: ctx.user.id, action: "auth.backup_codes_regenerated", ip: ctx.ip });
    return { backupCodes: result.backupCodes };
  });

/** Signs out one of the caller's other devices. */
export const revokeDevice = userAction
  .metadata({ actionName: "revokeDevice" })
  .inputSchema(deviceSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    // Never trust a client-supplied id: only the caller's own sessions qualify.
    const [target] = await getDb()
      .select({ token: sessionTable.token })
      .from(sessionTable)
      .where(and(eq(sessionTable.id, input.sessionId), eq(sessionTable.userId, ctx.user.id)))
      .limit(1);
    if (!target) returnServerError<ActionErrorCode>("not_found");
    // This device signs out through "Log out", which also clears its cookie.
    if (input.sessionId === ctx.sessionId) returnServerError<ActionErrorCode>("invalid");

    await auth.api.revokeSession({ body: { token: target.token }, headers: await authRequestHeaders() });
    await audit(getDb(), {
      actorId: ctx.user.id,
      action: "auth.device_revoked",
      targetType: "session",
      targetId: input.sessionId,
      ip: ctx.ip,
    });
    refreshSecurity();
  });

export const revokeOtherDevices = userAction.metadata({ actionName: "revokeOtherDevices" }).action(async ({ ctx }) => {
  await auth.api.revokeOtherSessions({ headers: await authRequestHeaders() });
  await audit(getDb(), { actorId: ctx.user.id, action: "auth.other_devices_revoked", ip: ctx.ip });
  refreshSecurity();
});

/** Step 1 of adding a passkey: options for the browser's passkey prompt. */
export const passkeyRegistrationOptions = userAction
  .metadata({ actionName: "passkeyRegistrationOptions" })
  .action(async () => auth.api.generatePasskeyRegistrationOptions({ headers: await authRequestHeaders() }));

/** Step 2: verifies the new passkey and names it after this device. */
export const registerPasskey = userAction
  .metadata({ actionName: "registerPasskey" })
  .inputSchema(passkeyRegisterSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const requestHeaders = await authRequestHeaders();
    const device = parseUserAgent(requestHeaders.get("user-agent"));
    const name = [device.browser, device.os].filter(Boolean).join(" · ") || "Passkey";
    try {
      await auth.api.verifyPasskeyRegistration({ body: { response: input.response, name }, headers: requestHeaders });
    } catch (error) {
      if (authErrorCode(error) !== null) returnServerError<ActionErrorCode>("invalid");
      throw error;
    }
    await audit(getDb(), { actorId: ctx.user.id, action: "auth.passkey_added", ip: ctx.ip });
    refreshSecurity();
  });

export const renamePasskey = userAction
  .metadata({ actionName: "renamePasskey" })
  .inputSchema(passkeyNameSchema)
  .action(async ({ parsedInput: input }) => {
    try {
      // The plugin only updates passkeys that belong to the session's user.
      await auth.api.updatePasskey({ body: { id: input.id, name: input.name }, headers: await authRequestHeaders() });
    } catch (error) {
      if (authErrorCode(error) !== null) returnServerError<ActionErrorCode>("not_found");
      throw error;
    }
    refreshSecurity();
  });

export const deletePasskey = userAction
  .metadata({ actionName: "deletePasskey" })
  .inputSchema(passkeyIdSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    try {
      await auth.api.deletePasskey({ body: { id: input.id }, headers: await authRequestHeaders() });
    } catch (error) {
      if (authErrorCode(error) !== null) returnServerError<ActionErrorCode>("not_found");
      throw error;
    }
    await audit(getDb(), { actorId: ctx.user.id, action: "auth.passkey_removed", targetId: input.id, ip: ctx.ip });
    refreshSecurity();
  });
