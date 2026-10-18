import "server-only";

import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { loadProfile } from "@/server/features/profile/queries";

import { initialsOf } from "@/lib/initials";

import type { AccountSummaryDto } from "./dto";

/** The signed-in viewer's summary for the top bar, or null when signed out. */
export const getAccountSummary = cache(async (): Promise<AccountSummaryDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const profile = await loadProfile(session.user.id);
  const displayName = profile?.displayName ?? session.user.name;
  return { displayName, initials: initialsOf(displayName), email: session.user.email };
});
