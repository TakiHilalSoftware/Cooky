"use server";

import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import type { DiscoverPageDto, SaveCatalogDishResult } from "@/server/features/discover/dto";
import { loadDiscoverPage } from "@/server/features/discover/queries";
import { discoverMoreSchema, saveCatalogDishSchema } from "@/server/features/discover/schema";
import { saveCatalogCopy } from "@/server/features/discover/write";

import { enforceBurst, publicAction, userAction } from "./_clients";

/**
 * The next page of Discover while scrolling (public, read-only). Same
 * filters and order as the page that rendered the first ones.
 */
export const loadMoreDiscover = publicAction
  .metadata({ actionName: "loadMoreDiscover" })
  .inputSchema(discoverMoreSchema)
  .action(async ({ parsedInput: { page, locale, ...filters }, ctx }): Promise<DiscoverPageDto> => {
    await enforceBurst("publicReadIp", ctx.ip);
    return loadDiscoverPage(filters, page, locale);
  });

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
