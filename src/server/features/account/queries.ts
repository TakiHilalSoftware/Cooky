import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";

import { getSession, isAdmin } from "@/server/auth/session";
import { loadProfile } from "@/server/features/profile/queries";
import { getSocialBadges } from "@/server/features/social/queries";
import { realtimeConfigFor } from "@/server/realtime/pusher";

import { initialsOf } from "@/lib/initials";
import { smallPhotoUrl } from "@/server/storage/photos";

import type { AccountSummaryDto } from "./dto";

/** The signed-in viewer's summary for the top bar, or null when signed out. */
export const getAccountSummary = cache(async (): Promise<AccountSummaryDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const [profile, badges] = await Promise.all([loadProfile(session.user.id), getSocialBadges()]);
  const displayName = profile?.displayName ?? session.user.name;
  return {
    displayName,
    initials: initialsOf(displayName),
    email: session.user.email,
    avatarUrl: await smallPhotoUrl(profile?.avatarKey ?? null),
    deviceKey: createHash("sha256").update(`cooky-offline:${session.user.id}`).digest("hex").slice(0, 24),
    badges: badges ?? { newRequests: 0, unreadMessages: false },
    realtime: realtimeConfigFor(session.user.id),
    isAdmin: isAdmin(session),
  };
});
