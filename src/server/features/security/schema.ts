// Shared by Server Actions (authoritative) and forms (instant hints). Messages
// are keys under `validation.*` (src/lib/validation-keys.ts).
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { PASSWORD_MAX, PASSWORD_MIN, safeNextPath } from "@/server/features/auth/schema";

const currentPassword = z.string().min(1, "passwordRequired").max(PASSWORD_MAX, "passwordTooLong");
const newPassword = z.string().min(PASSWORD_MIN, "passwordTooShort").max(PASSWORD_MAX, "passwordTooLong");

export const changePasswordSchema = z.object({ currentPassword, newPassword });

/** Re-confirms the password before enabling/disabling 2FA or new backup codes. */
export const confirmPasswordSchema = z.object({ password: currentPassword });

/** Six digits from an authenticator app; spaces people type are ignored. */
const totpCode = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "codeFormat"));

export const totpCodeSchema = z.object({ code: totpCode });

export const twoFactorSignInSchema = z.object({
  code: totpCode,
  trustDevice: z.boolean().default(false),
  next: safeNextPath,
  locale: z.enum(routing.locales),
});

export const backupCodeSignInSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "backupCodeFormat")
    .max(32, "backupCodeFormat")
    .regex(/^[A-Za-z0-9-]+$/, "backupCodeFormat"),
  next: safeNextPath,
  locale: z.enum(routing.locales),
});

export const deviceSchema = z.object({ sessionId: z.string().min(1).max(64) });

export const passkeyNameSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().trim().min(1, "passkeyNameRequired").max(40, "passkeyNameTooLong"),
});

export const passkeyIdSchema = z.object({ id: z.string().min(1).max(128) });

// WebAuthn credentials as @simplewebauthn/browser returns them (base64url
// strings). Only shape and size are checked here; the passkey plugin does the
// cryptographic verification.
const b64url = z
  .string()
  .max(8192)
  .regex(/^[A-Za-z0-9_-]*$/);
const TRANSPORTS = ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"] as const;
type Transport = (typeof TRANSPORTS)[number];
const isTransport = (value: string): value is Transport => (TRANSPORTS as readonly string[]).includes(value);
// Browsers report transports as plain strings; keep only the ones WebAuthn defines.
const transports = z
  .array(z.string().max(16))
  .max(8)
  .optional()
  .transform((list) => list?.filter(isTransport));
const credentialBase = {
  id: b64url.min(1),
  rawId: b64url.min(1),
  type: z.literal("public-key"),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
  // Extension outputs vary by browser; only "is an object" is checked here.
  clientExtensionResults: z
    .custom<AuthenticationResponseJSON["clientExtensionResults"]>(
      (value) => typeof value === "object" && value !== null && !Array.isArray(value),
    )
    .default({}),
};

export const webAuthnAuthenticationSchema = z.object({
  ...credentialBase,
  response: z.object({
    clientDataJSON: b64url,
    authenticatorData: b64url,
    signature: b64url,
    userHandle: b64url.optional(),
  }),
});

export const webAuthnRegistrationSchema = z.object({
  ...credentialBase,
  response: z.object({
    clientDataJSON: b64url,
    attestationObject: b64url,
    authenticatorData: b64url.optional(),
    transports,
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: b64url.optional(),
  }),
});

export const passkeyLoginSchema = z.object({
  response: webAuthnAuthenticationSchema,
  next: safeNextPath,
  locale: z.enum(routing.locales),
});

export const passkeyRegisterSchema = z.object({ response: webAuthnRegistrationSchema });
