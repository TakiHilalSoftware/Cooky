// What the UI may know about the signed-in account. Types only: safe for the UI.
import type { DataExportStatus } from "@/lib/admin";
import type { RealtimeConfigDto } from "@/server/realtime/dto";
import type { SocialBadgesDto } from "@/server/features/social/dto";

export type AccountSummaryDto = {
  displayName: string;
  /** One or two letters for the avatar, e.g. "AB". */
  initials: string;
  /** The viewer's own address; never another user's. */
  email: string;
  /** Signed link to the small profile photo, when there is one. */
  avatarUrl: string | null;
  /** Opaque per-account key for this device's offline copy: tells accounts apart, reveals nothing. */
  deviceKey: string;
  /** The Friends badge and the messages dot. */
  badges: SocialBadgesDto;
  /** The viewer's own private realtime channel; null when realtime is off. */
  realtime: RealtimeConfigDto;
  isAdmin: boolean;
};

/** Settings → Your data. */
export type YourDataDto = {
  /** The latest data export, if one was asked for. */
  export: {
    status: DataExportStatus | "expired";
    requestedAt: string;
    expiresAt: string | null;
    sizeBytes: number | null;
    /** A signed, expiring link, only while it's ready. */
    downloadPath: string | null;
  } | null;
  /** Password accounts confirm deletion with their password; Google/Apple ones with a fresh login. */
  hasPassword: boolean;
};
