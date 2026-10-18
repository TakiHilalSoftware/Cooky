"use server";

import type { IngredientSuggestionDto } from "@/server/features/ingredients/dto";
import { suggestIngredients as suggest } from "@/server/features/ingredients/dictionary";
import { suggestIngredientsSchema } from "@/server/features/ingredients/schema";

import { userReadAction } from "./_clients";

/** Ingredient autocomplete for the dish form (PRD §3.2): dictionary staples first, then the person's own names. */
export const suggestIngredients = userReadAction
  .metadata({ actionName: "suggestIngredients" })
  .inputSchema(suggestIngredientsSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<IngredientSuggestionDto[]> =>
    suggest(ctx.user.id, input.query, input.locale),
  );
