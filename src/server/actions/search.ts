"use server";

import type { SearchResultsDto } from "@/server/features/search/dto";
import { searchEverything } from "@/server/features/search/queries";
import { searchSchema } from "@/server/features/search/schema";

import { userReadAction } from "./_clients";

/** Global search while typing (roomy read burst limit, like autocomplete). */
export const search = userReadAction
  .metadata({ actionName: "search" })
  .inputSchema(searchSchema)
  .action(async ({ parsedInput: { q, locale }, ctx }): Promise<SearchResultsDto> =>
    searchEverything(ctx.user.id, q, locale),
  );
