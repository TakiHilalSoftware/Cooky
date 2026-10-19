"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import {
  appearanceSchema,
  completeOnboardingSchema,
  displayNameSchema,
  kitchenSchema,
  localeSchema,
} from "@/server/features/profile/schema";
import { favorites } from "@/server/db/schema";
import { saveCatalogCopy } from "@/server/features/discover/write";
import { addToPantry } from "@/server/features/kitchen/write";
import { withLocation } from "@/server/features/profile/location";
import { loadProfile } from "@/server/features/profile/queries";

import { userAction } from "./_clients";

/** Profile values show in the top bar and on <html>, so the whole tree refreshes. */
function refreshEverywhere() {
  revalidatePath("/[locale]", "layout");
}

/** Only ever the caller's own profile row: the id comes from the session, never the client. */
async function updateOwnProfile(userId: string, values: Partial<typeof profiles.$inferInsert>) {
  await getDb().update(profiles).set(values).where(eq(profiles.userId, userId));
}

export const updateDisplayName = userAction
  .metadata({ actionName: "updateDisplayName" })
  .inputSchema(displayNameSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await updateOwnProfile(ctx.user.id, { displayName: input.displayName });
    refreshEverywhere();
    return { displayName: input.displayName };
  });

export const updateAppearance = userAction
  .metadata({ actionName: "updateAppearance" })
  .inputSchema(appearanceSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await updateOwnProfile(ctx.user.id, input);
    refreshEverywhere();
  });

/** The language emails and notifications use; follows the language switcher. */
export const updateLocale = userAction
  .metadata({ actionName: "updateLocale" })
  .inputSchema(localeSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    await updateOwnProfile(ctx.user.id, { locale: input.locale });
  });

/** City (or location) and dietary preferences: Settings → Kitchen and onboarding. */
export const updateKitchen = userAction
  .metadata({ actionName: "updateKitchen" })
  .inputSchema(kitchenSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const profile = await loadProfile(ctx.user.id);
    const located = await withLocation(input, profile?.locale ?? "en");
    await updateOwnProfile(ctx.user.id, located);
    // The weather chip in every page's top bar follows the new place.
    revalidatePath("/[locale]", "layout");
    return located;
  });

/**
 * Finishes the starter pack (PRD §3.1): saves the kitchen, puts the picked
 * Discover dishes in the box as favorites, and marks onboarding done. Picks
 * that don't fit the plan's dish cap are simply skipped (and counted).
 */
export const completeOnboarding = userAction
  .metadata({ actionName: "completeOnboarding" })
  .inputSchema(completeOnboardingSchema)
  .action(async ({ parsedInput: { favorites: picks, staples, locale, ...input }, ctx }) => {
    const kitchen = await withLocation(input, locale);
    let saved = 0;
    for (const slug of new Set(picks)) {
      const result = await saveCatalogCopy(ctx.user.id, slug, locale);
      if (result.status === "saved" || result.status === "already") {
        await getDb().insert(favorites).values({ userId: ctx.user.id, dishId: result.dishId }).onConflictDoNothing();
        saved++;
      }
    }
    // The kitchen's cap is far above the 40 staples offered, so "full" can't happen here.
    await addToPantry(ctx.user.id, staples, true);
    await updateOwnProfile(ctx.user.id, { ...kitchen, onboardedAt: new Date() });
    revalidatePath("/[locale]", "layout");
    return { saved };
  });

/** "Skip for now": onboarding won't be offered again; everything stays editable in Settings. */
export const skipOnboarding = userAction.metadata({ actionName: "skipOnboarding" }).action(async ({ ctx }) => {
  await updateOwnProfile(ctx.user.id, { onboardedAt: new Date() });
  revalidatePath("/[locale]", "layout");
});
