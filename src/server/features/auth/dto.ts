// Outcomes the auth forms explain to the user. Types only: safe for the UI.

/** After sign-up we never reveal whether the email was already registered. */
export type SignUpResult = { status: "check_email" } | { status: "password_compromised" };

export type SignInResult =
  | { status: "invalid_credentials" }
  /** The account exists but isn't verified yet; a fresh link was just sent. */
  | { status: "verify_email" }
  /** Too many wrong passwords for this email; try again after `retryAt` (ISO time). */
  | { status: "locked"; retryAt: string | null };

/** Always the same answer, whether or not an account exists. */
export type EmailSentResult = { status: "sent" };

export type ResetPasswordResult =
  { status: "reset" } | { status: "invalid_token" } | { status: "password_compromised" };
