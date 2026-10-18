// Outcomes the auth forms explain to the user. Types only: safe for the UI.

/** After sign-up we never reveal whether the email was already registered. */
export type SignUpResult = { status: "check_email" } | { status: "password_compromised" };

export type SignInResult =
  | { status: "invalid_credentials" }
  /** The account exists but isn't verified yet; a fresh link was just sent. */
  | { status: "verify_email" }
  /** Too many wrong passwords for this email; try again after `retryAt` (ISO time). */
  | { status: "locked"; retryAt: string | null }
  /** An admin suspended this account. */
  | { status: "suspended" };

/** Always the same answer, whether or not an account exists. */
export type EmailSentResult = { status: "sent" };

export type ResetPasswordResult =
  { status: "reset" } | { status: "invalid_token" } | { status: "password_compromised" };

/** Where to send the browser to continue with the provider. */
export type SocialSignInResult = { url: string };

/** Sign-in providers the UI can offer (only configured ones are passed down). */
export type SocialProviderId = "google" | "apple";

/** Why the provider sent the person back to log in without a session. */
export type SocialSignInError = "not_linked" | "suspended" | "failed";
