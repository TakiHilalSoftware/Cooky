"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { appearanceSchema, displayNameSchema, localeSchema } from "@/server/features/profile/schema";

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
