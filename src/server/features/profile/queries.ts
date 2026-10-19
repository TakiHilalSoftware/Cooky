import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { DEFAULT_APPEARANCE, type Appearance } from "@/lib/appearance";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { initialsOf } from "@/lib/initials";
import { photoUrls } from "@/server/storage/photos";
import { storageConfigured } from "@/server/storage/r2";

import type { KitchenDto, ProfileSettingsDto } from "./dto";

/** The profile row, once per request. */
export const loadProfile = cache(async (userId: string) => {
  const [row] = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row ?? null;
});

/**
 * Accent, theme and text size for this request: the signed-in person's
 * choices, or the defaults. Read by the root layout so pages arrive styled.
 */
export const getAppearance = cache(async (): Promise<Appearance> => {
  const session = await getSession();
  const profile = session ? await loadProfile(session.user.id) : null;
  if (!profile) return DEFAULT_APPEARANCE;
  return { accent: profile.accent, theme: profile.theme, textSize: profile.textSize };
});

export const getProfileSettings = cache(async (): Promise<ProfileSettingsDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const profile = await loadProfile(session.user.id);
  const displayName = profile?.displayName ?? session.user.name;
  return {
    displayName,
    initials: initialsOf(displayName),
    email: session.user.email,
    locale: profile?.locale ?? "en",
    accent: profile?.accent ?? DEFAULT_APPEARANCE.accent,
    theme: profile?.theme ?? DEFAULT_APPEARANCE.theme,
    textSize: profile?.textSize ?? DEFAULT_APPEARANCE.textSize,
    avatar: { photo: await photoUrls(profile?.avatarKey ?? null), enabled: storageConfigured() },
  };
});

/** The kitchen settings (city, rough location, diet) and whether the starter pack is done. */
export const getKitchen = cache(async (): Promise<KitchenDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const profile = await loadProfile(session.user.id);
  return {
    city: profile?.city ?? null,
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
    dietaryPrefs: profile?.dietaryPrefs ?? [],
    onboarded: Boolean(profile?.onboardedAt),
  };
});
