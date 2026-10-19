import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const dishes = await import("@/server/actions/dishes");
const { getDeletedDish, getDish, getDishForEdit, listMyDishes } = await import("@/server/features/dishes/queries");
const { purgeDeleted } = await import("@/server/features/dishes/cleanup");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

const NO_FILTERS = { favorites: false } as const;

function tagine(overrides: Record<string, unknown> = {}) {
  return {
    name: "Chicken tagine",
    difficulty: "medium" as const,
    course: "main" as const,
    servings: 4,
    seasons: ["winter" as const],
    dietaryTags: ["halal" as const],
    ingredients: [
      { name: "Chicken thighs", amount: 1.2, unit: "kg" as const, note: null },
      { name: "Green olives", amount: 150, unit: "g" as const, note: "pitted" },
      { name: "Salt", amount: null, unit: null, note: null },
    ],
    steps: [
      { text: "Brown the chicken.", timerMinutes: 10, prepDayBefore: false },
      { text: "Simmer with the olives.", timerMinutes: 45, prepDayBefore: true },
    ],
    caloriesKcal: 520,
    proteinG: 38.5,
    carbsG: null,
    fatG: null,
    ...overrides,
  };
}

async function signedIn(email = "amina@example.com") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

async function addDish(overrides: Record<string, unknown> = {}) {
  const result = await dishes.createDish(tagine(overrides));
  if (!result.data) throw new Error(`createDish failed: ${JSON.stringify(result)}`);
  return result.data.id;
}

/** Fills the box straight in the database (fast), as if the person had added them over time. */
async function seedDishes(userId: string, count: number) {
  await db()
    .insert(schema.dishes)
    .values(
      Array.from({ length: count }, (_, i) => ({
        userId,
        name: `Dish ${i}`,
        difficulty: "easy" as const,
        course: "main" as const,
        servings: 2,
      })),
    );
}

describe("createDish", () => {
  it("requires a session", async () => {
    expect(await dishes.createDish(tagine())).toEqual({ serverError: "unauthorized" });
  });

  it("saves the dish with its ingredients and steps, in order, for the caller only", async () => {
    await signedIn();
    const id = await addDish();
    const dish = await getDish(id);
    expect(dish).toMatchObject({
      name: "Chicken tagine",
      servings: 4,
      shownServings: 4,
      seasons: ["winter"],
      dietaryTags: ["halal"],
      nutrition: { caloriesKcal: 520, proteinG: 38.5, carbsG: null, fatG: null },
      favorite: false,
      note: null,
      readOnly: false,
    });
    expect(dish?.ingredients.map((i) => i.name)).toEqual(["Chicken thighs", "Green olives", "Salt"]);
    expect(dish?.steps).toEqual([
      { text: "Brown the chicken.", timerMinutes: 10, prepDayBefore: false },
      { text: "Simmer with the olives.", timerMinutes: 45, prepDayBefore: true },
    ]);
  });

  it("validates on the server too: trims, requires an ingredient, rejects bad amounts", async () => {
    await signedIn();
    expect((await dishes.createDish(tagine({ name: "   " }))).validationErrors).toBeDefined();
    expect((await dishes.createDish(tagine({ ingredients: [] }))).validationErrors).toBeDefined();
    expect(
      (await dishes.createDish(tagine({ ingredients: [{ name: "Salt", amount: -1, unit: null, note: null }] })))
        .validationErrors,
    ).toBeDefined();
    expect(await db().select().from(schema.dishes)).toHaveLength(0);
    const id = await addDish({ name: "  Harira  " });
    expect((await getDish(id))?.name).toBe("Harira");
  });

  it("stops at the plan's cap from plan_limits, and says quota_exceeded (the upgrade sheet)", async () => {
    const userId = await signedIn();
    await seedDishes(userId, 49);
    await addDish();
    expect(await dishes.createDish(tagine())).toEqual({ serverError: "quota_exceeded" });
    expect((await listMyDishes(NO_FILTERS))?.allowance).toEqual({
      count: 50,
      limit: 50,
      canAdd: false,
      readOnly: false,
    });
  });

  it("parallel adds at the cap can't overshoot it", async () => {
    const userId = await signedIn();
    await seedDishes(userId, 45);
    const results = await Promise.all(Array.from({ length: 10 }, () => dishes.createDish(tagine())));
    expect(results.filter((r) => r.data)).toHaveLength(5);
    expect(results.filter((r) => r.serverError === "quota_exceeded")).toHaveLength(5);
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.dishes)
      .where(eq(schema.dishes.userId, userId));
    expect(row?.n).toBe(50);
  });

  it("deleted dishes free their place", async () => {
    const userId = await signedIn();
    await seedDishes(userId, 49);
    const id = await addDish();
    await dishes.deleteDish({ id });
    expect((await dishes.createDish(tagine())).data).toBeDefined();
  });
});

describe("someone else's dish", () => {
  it("can't be read, edited, deleted, starred or annotated, and looks like it doesn't exist", async () => {
    await signedIn("karim@example.com");
    const theirs = await addDish();
    await signedIn("amina@example.com");

    expect(await getDish(theirs)).toBeNull();
    expect(await getDishForEdit(theirs)).toBeNull();
    expect(await dishes.updateDish({ ...tagine({ name: "Mine now" }), id: theirs })).toEqual({
      serverError: "not_found",
    });
    expect(await dishes.deleteDish({ id: theirs })).toEqual({ serverError: "not_found" });
    expect(await dishes.setFavorite({ dishId: theirs, favorite: true })).toEqual({ serverError: "not_found" });
    expect(await dishes.saveDishNote({ dishId: theirs, text: "hi" })).toEqual({ serverError: "not_found" });
    expect((await listMyDishes(NO_FILTERS))?.dishes).toEqual([]);

    const [row] = await db().select().from(schema.dishes).where(eq(schema.dishes.id, theirs));
    expect(row).toMatchObject({ name: "Chicken tagine", deletedAt: null });
    expect(await db().select().from(schema.favorites)).toHaveLength(0);
  });
});

describe("updateDish", () => {
  it("replaces fields, ingredients and steps", async () => {
    await signedIn();
    const id = await addDish();
    const result = await dishes.updateDish({
      ...tagine({
        name: "Lamb tagine",
        servings: 6,
        ingredients: [{ name: "Lamb shoulder", amount: 1.5, unit: "kg", note: null }],
        steps: [],
      }),
      id,
    });
    expect(result).toEqual({ data: { id } });
    expect(await getDishForEdit(id)).toMatchObject({
      name: "Lamb tagine",
      servings: 6,
      ingredients: [{ name: "Lamb shoulder", amount: 1.5, unit: "kg", note: null }],
      steps: [],
    });
    expect(await db().select().from(schema.dishIngredients)).toHaveLength(1);
  });

  it("over the limit after a downgrade: viewable and deletable, not editable (PRD §3.7)", async () => {
    const userId = await signedIn();
    const id = await addDish();
    await seedDishes(userId, 55); // e.g. 56 dishes left over from Plus, now on Free (50)

    const dish = await getDish(id);
    expect(dish?.readOnly).toBe(true);
    expect(dish?.ingredients).toHaveLength(3);
    expect((await listMyDishes(NO_FILTERS))?.allowance).toMatchObject({ count: 56, readOnly: true, canAdd: false });
    expect(await dishes.updateDish({ ...tagine({ name: "Edited" }), id })).toEqual({ serverError: "quota_exceeded" });
    expect(await dishes.createDish(tagine())).toEqual({ serverError: "quota_exceeded" });
    // Notes and favorites aren't content: they keep working.
    expect((await dishes.saveDishNote({ dishId: id, text: "still mine" })).data).toEqual({ text: "still mine" });
    expect((await dishes.deleteDish({ id })).data).toMatchObject({ id });
  });
});

describe("deleteDish and restoreDish (Undo)", () => {
  it("hides the dish at once, offers it for Undo, and brings it back intact", async () => {
    await signedIn();
    const id = await addDish();
    expect(await dishes.deleteDish({ id })).toEqual({ data: { id, name: "Chicken tagine" } });
    expect(await getDish(id)).toBeNull();
    expect((await listMyDishes(NO_FILTERS))?.total).toBe(0);
    expect(await getDeletedDish(id)).toEqual({ id, name: "Chicken tagine" });

    expect(await dishes.restoreDish({ id })).toEqual({ data: { id } });
    expect((await getDish(id))?.ingredients).toHaveLength(3);
    expect(await getDeletedDish(id)).toBeNull();
  });

  it("Undo respects the cap: if the box filled up meanwhile, the upgrade sheet opens", async () => {
    const userId = await signedIn();
    await seedDishes(userId, 49);
    const id = await addDish();
    await dishes.deleteDish({ id });
    await addDish();
    expect(await dishes.restoreDish({ id })).toEqual({ serverError: "quota_exceeded" });
  });

  it("only the owner can restore, and only a deleted dish", async () => {
    await signedIn("karim@example.com");
    const theirs = await addDish();
    await dishes.deleteDish({ id: theirs });
    await signedIn("amina@example.com");
    expect(await getDeletedDish(theirs)).toBeNull();
    expect(await dishes.restoreDish({ id: theirs })).toEqual({ serverError: "not_found" });
    const mine = await addDish();
    expect(await dishes.restoreDish({ id: mine })).toEqual({ serverError: "not_found" });
  });

  it("the cleanup job removes dishes deleted over a day ago, with everything attached", async () => {
    await signedIn();
    const old = await addDish();
    const recent = await addDish({ name: "Harira" });
    await dishes.setFavorite({ dishId: old, favorite: true });
    await dishes.saveDishNote({ dishId: old, text: "note" });
    await dishes.deleteDish({ id: old });
    await dishes.deleteDish({ id: recent });
    await db()
      .update(schema.dishes)
      .set({ deletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(schema.dishes.id, old));

    expect(await purgeDeleted()).toEqual({ dishes: 1, collections: 0, imports: 0, messages: 0 });
    expect(await db().select({ id: schema.dishes.id }).from(schema.dishes)).toEqual([{ id: recent }]);
    expect(await db().select().from(schema.dishIngredients).where(eq(schema.dishIngredients.dishId, old))).toEqual([]);
    expect(await db().select().from(schema.favorites)).toEqual([]);
    expect(await db().select().from(schema.dishNotes)).toEqual([]);
  });
});

describe("favorites and notes", () => {
  it("stars and unstars, idempotently", async () => {
    const userId = await signedIn();
    const id = await addDish();
    await dishes.setFavorite({ dishId: id, favorite: true });
    await dishes.setFavorite({ dishId: id, favorite: true });
    expect((await getDish(id))?.favorite).toBe(true);
    expect(await db().select().from(schema.favorites).where(eq(schema.favorites.userId, userId))).toHaveLength(1);
    await dishes.setFavorite({ dishId: id, favorite: false });
    expect((await getDish(id))?.favorite).toBe(false);
  });

  it("saves, updates and clears the private note", async () => {
    const userId = await signedIn();
    const id = await addDish();
    expect((await dishes.saveDishNote({ dishId: id, text: "  less salt  " })).data).toEqual({ text: "less salt" });
    await dishes.saveDishNote({ dishId: id, text: "much less salt" });
    expect((await getDish(id))?.note).toBe("much less salt");
    expect((await dishes.saveDishNote({ dishId: id, text: "" })).data).toEqual({ text: null });
    expect(
      await db()
        .select()
        .from(schema.dishNotes)
        .where(and(eq(schema.dishNotes.dishId, id), eq(schema.dishNotes.userId, userId))),
    ).toEqual([]);
  });
});

describe("listMyDishes", () => {
  it("searches accent-insensitively and forgives typos, and filters by course and favorites", async () => {
    await signedIn();
    const tagineId = await addDish({ name: "Tajine de poulet" });
    await addDish({ name: "Crème brûlée", course: "dessert" });
    await addDish({ name: "Harira", course: "appetizer" });
    await dishes.setFavorite({ dishId: tagineId, favorite: true });

    const names = async (filters: Record<string, unknown>) =>
      (await listMyDishes({ favorites: false, ...filters }))?.dishes.map((d) => d.name).sort();

    expect(await names({ q: "creme" })).toEqual(["Crème brûlée"]);
    expect(await names({ q: "tajin" })).toEqual(["Tajine de poulet"]);
    expect(await names({ q: "100%_" })).toEqual([]);
    expect(await names({ course: "dessert" })).toEqual(["Crème brûlée"]);
    expect(await names({ favorites: true })).toEqual(["Tajine de poulet"]);
    const list = await listMyDishes({ favorites: false, q: "nothing like this" });
    expect(list).toMatchObject({ dishes: [], total: 3 });
  });

  it("summarises each card: ingredient and step counts, total timer minutes", async () => {
    await signedIn();
    await addDish();
    expect((await listMyDishes(NO_FILTERS))?.dishes[0]).toMatchObject({
      name: "Chicken tagine",
      ingredientCount: 3,
      stepCount: 2,
      timerMinutes: 55,
      favorite: false,
    });
  });
});

describe("getDish scaling", () => {
  it("scales amounts on the server and keeps 'to taste' as written", async () => {
    await signedIn();
    const id = await addDish();
    const dish = await getDish(id, 6);
    expect(dish?.shownServings).toBe(6);
    expect(dish?.ingredients.map((i) => i.amount)).toEqual([1.8, 225, null]);
    // The stored recipe is untouched.
    expect((await getDishForEdit(id))?.ingredients.map((i) => i.amount)).toEqual([1.2, 150, null]);
  });
});
