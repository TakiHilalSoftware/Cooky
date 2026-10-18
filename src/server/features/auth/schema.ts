// Shared by Server Actions (authoritative) and forms (instant hints). No
// server-only import: components may use these schemas. Messages are
// translation keys under `validation.*`.
import { z } from "zod";

import { routing } from "@/i18n/routing";

/** Every message key these schemas can produce; each must exist under `validation.*`. */
export const VALIDATION_KEYS = [
  "emailInvalid",
  "emailTooLong",
  "nameRequired",
  "nameTooLong",
  "passwordRequired",
  "passwordTooShort",
  "passwordTooLong",
  "acceptTermsRequired",
] as const;
export type ValidationKey = (typeof VALIDATION_KEYS)[number];

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === "string" && (VALIDATION_KEYS as readonly string[]).includes(value);
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const locale = z.enum(routing.locales);
const email = z.string().trim().toLowerCase().max(254, "emailTooLong").pipe(z.email("emailInvalid"));
const newPassword = z.string().min(PASSWORD_MIN, "passwordTooShort").max(PASSWORD_MAX, "passwordTooLong");

/** Internal app paths only, so a crafted `next` link can't redirect off-site. */
export const safeNextPath = z
  .string()
  .max(512)
  .regex(/^\/(?![/\\])[\w\-./?=&%~]*$/)
  .optional()
  .catch(undefined);

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(60, "nameTooLong"),
  email,
  password: newPassword,
  acceptTerms: z.literal(true, "acceptTermsRequired"),
  locale,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "passwordRequired").max(PASSWORD_MAX, "passwordTooLong"),
  next: safeNextPath,
  locale,
});

export const emailOnlySchema = z.object({ email, locale });

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  password: newPassword,
  locale,
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
