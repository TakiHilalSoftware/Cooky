// What the Security settings and sign-in steps may know. Types only: safe for the UI.
import type { DeviceKind } from "./user-agent";

export type DeviceDto = {
  /** Session id (never the token). */
  id: string;
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
  /** The device making this request. */
  current: boolean;
  lastActiveAt: string;
  signedInAt: string;
};

export type PasskeyDto = {
  id: string;
  name: string | null;
  createdAt: string | null;
  /** Synced across the person's devices (e.g. iCloud Keychain, Google Password Manager). */
  synced: boolean;
};

export type SecurityOverviewDto = {
  twoFactorEnabled: boolean;
  /** False for accounts created with Google/Apple only. */
  hasPassword: boolean;
  passkeys: PasskeyDto[];
  devices: DeviceDto[];
};

/** Step 1 of turning on 2FA: what to scan or type into the authenticator app. */
export type TwoFactorSetupDto = { qrSvg: string; secret: string; backupCodes: string[] };

export type BackupCodesDto = { backupCodes: string[] };

export type PasswordCheckResult = { status: "ok" } | { status: "wrong_password" };

export type ChangePasswordResult =
  { status: "changed" } | { status: "wrong_password" } | { status: "password_compromised" };

export type TwoFactorCodeResult =
  | { status: "invalid_code" }
  /** The 10-minute sign-in window passed; start again from the log-in page. */
  | { status: "expired" }
  | { status: "locked" };

export type PasskeyLoginResult = { status: "not_recognised" } | { status: "cancelled" };
