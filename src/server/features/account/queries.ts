import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

import { initialsOf, type AccountSummaryDto } from "./dto";

/** The signed-in viewer's summary for the top bar, or null when signed out. */
export const getAccountSummary = cache(async (): Promise<AccountSummaryDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const [profile] = await getDb()
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);
  const displayName = profile?.displayName ?? session.user.name;
  return { displayName, initials: initialsOf(displayName), email: session.user.email };
});
