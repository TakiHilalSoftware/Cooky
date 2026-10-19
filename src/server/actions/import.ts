"use server";

import { returnServerError } from "next-safe-action";

import type { ActionErrorCode } from "@/lib/errors";
import type { DishDraftDto } from "@/server/features/dishes/dto";
import { importFromUrlSchema } from "@/server/features/dishes/schema";
import { fetchPage, ImportFetchError } from "@/server/importer/fetch";
import { aiExtractRecipe } from "@/server/importer/ai-recipe";
import { extractRecipe } from "@/server/importer/recipe";

import { meteredAction } from "./_clients";

/**
 * Import from a link (PRD §3.2, uses an import try): reads the recipe the
 * page publishes and returns a draft for the dish form. Nothing is saved
 * until the person reviews it. If the page can't be read, the try is given
 * back (meteredAction refunds failures).
 */
export const importFromUrl = meteredAction("import")
  .metadata({ actionName: "importFromUrl" })
  .inputSchema(importFromUrlSchema)
  .action(async ({ parsedInput: input }): Promise<DishDraftDto> => {
    let page: Awaited<ReturnType<typeof fetchPage>>;
    try {
      page = await fetchPage(input.url);
    } catch (err) {
      const problem = err instanceof ImportFetchError ? err.problem : "unreachable";
      returnServerError<ActionErrorCode>(
        problem === "invalid_url" || problem === "blocked" ? "invalid" : "unavailable",
      );
    }
    // Schema.org data first; pages without it get the AI fallback, on the same try.
    const recipe = extractRecipe(page.html, page.url) ?? (await aiExtractRecipe(page.html, page.url));
    if (!recipe) returnServerError<ActionErrorCode>("not_found");
    return {
      name: recipe.name,
      difficulty: "easy",
      course: "main",
      servings: recipe.servings ?? 4,
      seasons: [],
      dietaryTags: [],
      ingredients: recipe.ingredients,
      steps: recipe.steps.map((text) => ({ text, timerMinutes: null, prepDayBefore: false })),
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      source: { url: page.url.toString(), siteName: recipe.siteName, imageUrl: recipe.imageUrl },
    };
  });
