/**
 * Adds TheMealDB recipes to the Discover catalog (source "mealdb"), in
 * English, with their photos. Curated dishes (seed-catalog.ts) always win:
 * a recipe with the same name is skipped, never duplicated, and curated rows
 * are never touched. Imports are never featured: featuring is an editorial
 * choice made in seed-catalog.ts.
 *
 * Upserts by slug. When every request succeeded, imported dishes that are no
 * longer in the feed leave the catalog (saved copies keep their own text).
 *
 * TheMealDB's free key ("1") is for development; production needs their
 * supporter key (https://www.themealdb.com/api.php).
 *
 *   pnpm db:seed:mealdb
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployments provide variables directly.
}

import type { MealDbRecipe } from "./mealdb-parse";

const { and, eq, notInArray } = await import("drizzle-orm");
const { getDb } = await import("../src/server/db/client");
const { catalogDishes, catalogIngredients, catalogSteps, ingredients } = await import("../src/server/db/schema");
const {
  AREA_TO_COUNTRY,
  courseFor,
  describe,
  inferDietaryTags,
  ingredientLines,
  parseSteps,
  sameName,
  seasonsFor,
  slugify,
} = await import("./mealdb-parse");

const API = "https://www.themealdb.com/api/json/v1/1";
/** Letters whose searches return enough variety; TheMealDB has no paged "list everything". */
const LETTERS = ["a", "b", "c", "f", "k", "l", "m", "p", "r", "s", "t"];

async function fetchMeals(letter: string): Promise<MealDbRecipe[] | null> {
  try {
    const res = await fetch(`${API}/search.php?f=${letter}`, { headers: { "User-Agent": "Cooky-Ingest/1.0" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { meals: MealDbRecipe[] | null };
    return body.meals ?? [];
  } catch (err) {
    console.error(`Fetching '${letter}' failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const db = getDb();
const staples = await db.select().from(ingredients);
const stapleBySlug = new Map(staples.map((r) => [r.slug, r]));
const stapleByName = new Map(staples.map((r) => [r.nameEn.toLowerCase(), r]));
const curated = await db
  .select({ slug: catalogDishes.slug, nameEn: catalogDishes.nameEn })
  .from(catalogDishes)
  .where(eq(catalogDishes.source, "curated"));

const meals = new Map<string, MealDbRecipe>();
let complete = true;
for (const letter of LETTERS) {
  const batch = await fetchMeals(letter);
  if (batch === null) complete = false;
  for (const meal of batch ?? []) meals.set(meal.idMeal, meal);
}
console.log(`Fetched ${meals.size} recipes${complete ? "" : " (some requests failed)"}.`);

const imported: string[] = [];
const skipped = { noCountry: 0, curated: 0, incomplete: 0 };
for (const meal of meals.values()) {
  const country = AREA_TO_COUNTRY[meal.strArea ?? ""];
  if (!country) {
    skipped.noCountry++;
    continue;
  }
  const slug = slugify(meal.strMeal);
  if (curated.some((c) => c.slug === slug || sameName(c.nameEn, meal.strMeal))) {
    skipped.curated++;
    continue;
  }
  const lines = ingredientLines(meal);
  const steps = parseSteps(meal.strInstructions);
  if (!slug || !meal.strMealThumb || lines.length === 0 || steps.length === 0 || imported.includes(slug)) {
    skipped.incomplete++;
    continue;
  }

  const dietaryTags = inferDietaryTags(lines.map((l) => l.name));
  const values = {
    slug,
    country,
    course: courseFor(meal.strCategory),
    difficulty: steps.length <= 4 ? "easy" : steps.length <= 8 ? "medium" : "hard",
    servings: 4,
    seasons: seasonsFor(meal.strMeal, meal.strCategory),
    dietaryTags,
    collections: [],
    featured: false,
    photoUrl: meal.strMealThumb,
    source: "mealdb",
    nameEn: meal.strMeal.trim(),
    nameFr: null,
    nameAr: null,
    descriptionEn: describe(
      meal.strArea!,
      meal.strCategory,
      lines.map((l) => l.name),
      dietaryTags,
    ),
    descriptionFr: null,
    descriptionAr: null,
  } satisfies typeof catalogDishes.$inferInsert;

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(catalogDishes)
      .values(values)
      .onConflictDoUpdate({
        target: catalogDishes.slug,
        set: { ...values, updatedAt: new Date() },
        // Never overwrite a curated dish that happens to share the slug.
        setWhere: eq(catalogDishes.source, "mealdb"),
      })
      .returning({ id: catalogDishes.id });
    if (!row) return;
    await tx.delete(catalogIngredients).where(eq(catalogIngredients.catalogDishId, row.id));
    await tx.delete(catalogSteps).where(eq(catalogSteps.catalogDishId, row.id));
    await tx.insert(catalogIngredients).values(
      lines.map((line, position) => ({
        catalogDishId: row.id,
        position,
        amount: line.amount,
        unit: line.unit,
        ingredientId: (stapleBySlug.get(slugify(line.name)) ?? stapleByName.get(line.name.toLowerCase()))?.id ?? null,
        nameEn: line.name,
        noteEn: line.note,
      })),
    );
    await tx.insert(catalogSteps).values(
      steps.map((step, position) => ({
        catalogDishId: row.id,
        position,
        textEn: step.text,
        timerSeconds: step.timerSeconds,
      })),
    );
  });
  imported.push(slug);
}

// Only with a complete feed: a failed request must not empty the catalog.
let removed = 0;
if (complete && imported.length > 0) {
  const gone = await db
    .delete(catalogDishes)
    .where(and(eq(catalogDishes.source, "mealdb"), notInArray(catalogDishes.slug, imported)))
    .returning({ slug: catalogDishes.slug });
  removed = gone.length;
}
console.log(
  `Imported ${imported.length} dishes; removed ${removed} stale imports; skipped ${skipped.curated} that duplicate curated dishes, ` +
    `${skipped.noCountry} without a known country, ${skipped.incomplete} incomplete.`,
);
process.exit(0);
