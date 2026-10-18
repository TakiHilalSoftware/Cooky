import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const { suggestIngredients } = await import("@/server/actions/ingredients");
const dishes = await import("@/server/actions/dishes");
const { listMyDishes } = await import("@/server/features/dishes/queries");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

async function signedIn(email = "amina@example.com") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

function dish(name: string, ingredientNames: string[]) {
  return {
    name,
    difficulty: "easy" as const,
    course: "main" as const,
    servings: 2,
    seasons: [],
    dietaryTags: [],
    ingredients: ingredientNames.map((n) => ({ name: n, amount: null, unit: null, note: null })),
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
}

const names = async (query: string, locale: "en" | "fr" | "ar" = "en") =>
  ((await suggestIngredients({ query, locale })).data ?? []).map((s) => s.name);

describe("suggestIngredients", () => {
  it("requires a session", async () => {
    expect(await suggestIngredients({ query: "tom", locale: "en" })).toEqual({ serverError: "unauthorized" });
  });

  it("suggests dictionary staples whose names start with what was typed, best first, with their usual unit", async () => {
    await signedIn();
    const { data } = await suggestIngredients({ query: "toma", locale: "en" });
    expect(data?.[0]).toEqual({ name: "Tomato", defaultUnit: "piece", source: "dictionary" });
    expect(data?.map((s) => s.name)).toEqual(expect.arrayContaining(["Tomato paste", "Canned tomatoes"]));
  });

  it("answers in the person's language, whatever language they typed in", async () => {
    await signedIn();
    expect((await names("tomate", "ar"))[0]).toBe("طماطم");
    expect((await names("tomato", "fr"))[0]).toBe("Tomate");
    // Regional Arabic finds the staple: بندورة (Levant), معدنوس (Maghreb).
    expect(await names("بندوره", "ar")).toContain("طماطم");
    expect(await names("معدنوس", "en")).toContain("Parsley");
    // Accents and Arabic letter forms don't matter.
    expect(await names("epinard", "fr")).toContain("Épinards");
    expect(await names("الأرز", "ar")).toContain("أرز");
  });

  it("forgives small typos", async () => {
    await signedIn();
    expect(await names("chickpeaz")).toContain("Chickpeas");
  });

  it("adds the person's own names that the dictionary doesn't know, only theirs", async () => {
    await signedIn("karim@example.com");
    await dishes.createDish(dish("Karim's", ["Grandpa's secret sauce"]));
    await signedIn("amina@example.com");
    await dishes.createDish(dish("Mine", ["Grandma's spice mix", "Tomatoes"]));

    const { data } = await suggestIngredients({ query: "grand", locale: "en" });
    expect(data).toEqual([{ name: "Grandma's spice mix", defaultUnit: null, source: "yours" }]);
    // A name linked to the dictionary isn't repeated as "yours".
    expect(
      ((await suggestIngredients({ query: "tomatoes", locale: "en" })).data ?? []).filter((s) => s.source === "yours"),
    ).toEqual([]);
  });

  it("returns nothing for blank input and caps the length", async () => {
    await signedIn();
    expect(await names("   ")).toEqual([]);
    expect((await suggestIngredients({ query: "x".repeat(61), locale: "en" })).validationErrors).toBeDefined();
    expect((await names("a")).length).toBeLessThanOrEqual(8);
  });
});

describe("linking dish ingredients to the dictionary", () => {
  it("links lines whose name is a staple in any language or variant, and leaves the rest", async () => {
    await signedIn();
    const { data } = await dishes.createDish(dish("Shakshuka", ["Tomatoes", "بندورة", "Œufs", "Grandma's spice mix"]));
    const rows = await db()
      .select({ name: schema.dishIngredients.name, slug: schema.ingredients.slug })
      .from(schema.dishIngredients)
      .leftJoin(schema.ingredients, eq(schema.ingredients.id, schema.dishIngredients.ingredientId))
      .where(eq(schema.dishIngredients.dishId, data!.id))
      .orderBy(schema.dishIngredients.position);
    expect(rows).toEqual([
      { name: "Tomatoes", slug: "tomato" },
      { name: "بندورة", slug: "tomato" },
      { name: "Œufs", slug: "egg" },
      { name: "Grandma's spice mix", slug: null },
    ]);
  });
});

describe("My Dishes search by ingredient", () => {
  it("finds dishes that use what was searched, by the matching rules", async () => {
    await signedIn();
    await dishes.createDish(dish("Harira", ["Red lentils", "Chickpeas", "Celery"]));
    await dishes.createDish(dish("Fried eggs", ["Eggs", "Olive oil"]));
    await dishes.createDish(dish("Boiled potatoes", ["Potatoes", "Salt"]));

    const found = async (q: string) =>
      ((await listMyDishes({ favorites: false, q }))?.dishes ?? []).map((d) => d.name).sort();

    expect(await found("lentil")).toEqual(["Harira"]);
    expect(await found("potato")).toEqual(["Boiled potatoes"]);
    // "oil" matches "Olive oil", never "Boiled".
    expect(await found("oil")).toEqual(["Fried eggs"]);
  });
});
