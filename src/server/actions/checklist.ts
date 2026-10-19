"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

import { userAction } from "./_clients";

/** Hides the first-week checklist for good (PRD §3.1: dismissible). */
export const dismissChecklist = userAction
  .metadata({ actionName: "dismissChecklist" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    await getDb().update(profiles).set({ checklistDismissedAt: new Date() }).where(eq(profiles.userId, ctx.user.id));
    revalidatePath("/[locale]/dishes", "page");
    return { dismissed: true };
  });
