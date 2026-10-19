"use server";

import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import type { SaveCatalogDishResult } from "@/server/features/discover/dto";
import { saveCatalogDishSchema } from "@/server/features/discover/schema";
import { saveCatalogCopy } from "@/server/features/discover/write";

import { userAction } from "./_clients";

/** "Save to my dishes" (PRD §3.3). Saving twice returns the existing copy; a full box opens the upgrade sheet. */
export const saveCatalogDish = userAction
  .metadata({ actionName: "saveCatalogDish" })
  .inputSchema(saveCatalogDishSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<SaveCatalogDishResult> => {
    const result = await saveCatalogCopy(ctx.user.id, input.slug, input.locale);
    if (result.status === "missing") returnServerError<ActionErrorCode>("not_found");
    if (result.status === "full") returnServerError<ActionErrorCode>("quota_exceeded");
    revalidatePath("/[locale]/dishes", "layout");
    revalidatePath("/[locale]/discover", "layout");
    return { dishId: result.dishId, alreadySaved: result.status === "already" };
  });
