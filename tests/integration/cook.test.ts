import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MealSlot } from "@/lib/dishes";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const dishes = await import("@/server/actions/dishes");
const kitchen = await import("@/server/actions/kitchen");
const cook = await import("@/server/actions/cook");
const collections = await import("@/server/actions/collections");
const { spinDish } = await import("@/server/actions/spin");
const { getCook, getKitchenUsedBy } = await import("@/server/features/cook/queries");
const { getDish } = await import("@/server/features/dishes/queries");
const { getPantry } = await import("@/server/features/kitchen/queries");
const tries = await import("@/server/quota/tries");
const { dayIn } = await import("@/lib/dates");

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

const base = {
  difficulty: "easy" as const,
  course: "main" as const,
  servings: 4,
  seasons: [] as ("spring" | "summer" | "autumn" | "winter")[],
  dietaryTags: [],
  steps: [],
  caloriesKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

async function addDish(name: string, ingredientNames: string[], extra: Partial<typeof base> = {}) {
  const { data } = await dishes.createDish({
    ...base,
    ...extra,
    name,
    ingredients: ingredientNames.map((n) => ({ name: n, amount: null, unit: null, note: null })),
  });
  return data!.id;
}

const NO_FILTERS = {
  with: [] as string[],
  without: [] as string[],
  collection: null as string | null,
  meal: null as MealSlot | null,
};
const ranked = async (filters = NO_FILTERS) => (await getCook(filters, "en"))!.dishes.map((d) => d.name);

describe("Cook", () => {
  it("ranks what you can make now first and says what's missing, in your language", async () => {
    await signedIn();
    await addDish("Lentil soup", ["Lentils", "Onion", "Cumin"]);
    await addDish("Omelette", ["Eggs", "Salt"]);
    await kitchen.addPantryItems({ names: ["eggs", "onion"] });
    await kitchen.addPantryItems({ names: ["salt"], staple: true });

    const result = (await getCook(NO_FILTERS, "fr"))!;
    expect(result.dishes.map((d) => [d.name, d.missing])).toEqual([
      ["Omelette", []],
      ["Lentil soup", ["Lentilles", "Cumin"]],
    ]);
    expect(result.have.map((h) => h.name)).toEqual(expect.arrayContaining(["Œufs", "Oignon", "Sel"]));
  });

  it("tries what-ifs without touching My kitchen: leave something out, or add something", async () => {
    await signedIn();
    await addDish("Omelette", ["Eggs"]);
    await addDish("Lemonade", ["Lemons", "Sugar"]);
    await kitchen.addPantryItems({ names: ["eggs", "sugar"] });
    const eggs = (await getPantry("en"))!.items.find((i) => i.name === "Eggs")!;

    expect(await ranked()).toEqual(["Omelette", "Lemonade"]);
    expect(await ranked({ ...NO_FILTERS, with: ["lemons"], without: [eggs.id] })).toEqual(["Lemonade", "Omelette"]);
    expect((await getPantry("en"))!.items).toHaveLength(2);
  });

  it("narrows to one of the person's collections, and ignores anyone else's", async () => {
    await signedIn("amina@example.com");
    const soup = await addDish("Lentil soup", ["Lentils"]);
    await addDish("Omelette", ["Eggs"]);
    const winter = (await collections.createCollection({ name: "Winter" })).data!;
    expect((await collections.setDishCollections({ dishId: soup, collectionIds: [winter.id] })).data).toBeDefined();

    const narrowed = (await getCook({ ...NO_FILTERS, collection: winter.id }, "en"))!;
    expect(narrowed.dishes.map((d) => d.name)).toEqual(["Lentil soup"]);
    expect(narrowed.collection).toBe(winter.id);
    expect(narrowed.collections).toEqual([{ id: winter.id, name: "Winter", dishCount: 1 }]);
    // The box total stays the whole box, so "no dishes yet" never shows for a small collection.
    expect(narrowed.total).toBe(2);

    await signedIn("karim@example.com");
    await addDish("Karim's couscous", ["Semolina"]);
    const theirs = (await getCook({ ...NO_FILTERS, collection: winter.id }, "en"))!;
    expect(theirs.collection).toBeNull();
    expect(theirs.dishes.map((d) => d.name)).toEqual(["Karim's couscous"]);
  });

  it("only ever shows the person's own dishes", async () => {
    await signedIn("amina@example.com");
    await addDish("Amina's tagine", ["Chicken"]);
    await signedIn("karim@example.com");
    expect((await getCook(NO_FILTERS, "en"))!.total).toBe(0);
  });

  it("moves a dish cooked today down the list", async () => {
    await signedIn();
    await addDish("Couscous", ["Semolina"]);
    await addDish("Tagine", ["Semolina"]);
    const [top, other] = (await getCook(NO_FILTERS, "en"))!.dishes;
    await cook.logCook({ dishId: top!.id });
    const after = (await getCook(NO_FILTERS, "en"))!.dishes;
    expect(after.map((d) => d.name)).toEqual([other!.name, top!.name]);
    expect(after[1]?.daysSinceCooked).toBe(0);
  });
});

describe("logging a cook", () => {
  it("records it on the person's local day, with Undo", async () => {
    const userId = await signedIn();
    const id = await addDish("Harira", ["Lentils"]);
    browser.cookies.set("cooky.tz", "Pacific/Kiritimati");
    const { data } = await cook.logCook({ dishId: id });
    expect(data).toMatchObject({ dishId: id, date: dayIn("Pacific/Kiritimati") });
    expect((await getDish(id))?.cooking).toMatchObject({ timesCooked: 1, canRate: true });

    expect((await cook.undoLogCook({ id: data!.id })).data).toEqual({ id: data!.id });
    expect(await db().select().from(schema.cookLog).where(eq(schema.cookLog.userId, userId))).toHaveLength(0);
  });

  it("removes kitchen items that ran out, but never staples", async () => {
    await signedIn();
    const id = await addDish("Omelette", ["Eggs", "Salt", "Butter"]);
    await kitchen.addPantryItems({ names: ["eggs", "butter"] });
    await kitchen.addPantryItems({ names: ["salt"], staple: true });
    const used = await getKitchenUsedBy(id, "en");
    expect(used.map((u) => u.name).sort()).toEqual(["Butter", "Eggs"]);
    const salt = (await getPantry("en"))!.items.find((i) => i.name === "Salt")!;

    await cook.logCook({ dishId: id, finished: [...used.filter((u) => u.name === "Eggs").map((u) => u.id), salt.id] });
    expect((await getPantry("en"))!.items.map((i) => i.name).sort()).toEqual(["Butter", "Salt"]);
  });

  it("refuses someone else's dish or log entry", async () => {
    await signedIn("amina@example.com");
    const theirs = await addDish("Amina's dish", ["Rice"]);
    const { data: entry } = await cook.logCook({ dishId: theirs });
    await signedIn("karim@example.com");
    expect(await cook.logCook({ dishId: theirs })).toEqual({ serverError: "not_found" });
    expect(await cook.undoLogCook({ id: entry!.id })).toEqual({ serverError: "not_found" });
    expect(await cook.rateDish({ dishId: theirs, stars: 1, review: null })).toEqual({ serverError: "not_found" });
  });
});

describe("rating", () => {
  it("is only possible after cooking, and can be changed", async () => {
    await signedIn();
    const id = await addDish("Baklava", ["Filo"]);
    expect(await cook.rateDish({ dishId: id, stars: 5, review: "Perfect" })).toEqual({ serverError: "forbidden" });
    await cook.logCook({ dishId: id });
    expect((await cook.rateDish({ dishId: id, stars: 5, review: "Perfect" })).data).toEqual({
      stars: 5,
      review: "Perfect",
    });
    await cook.rateDish({ dishId: id, stars: 4, review: "  " });
    expect((await getDish(id))?.cooking.rating).toEqual({ stars: 4, review: null });
    expect((await cook.rateDish({ dishId: id, stars: 6, review: null })).validationErrors).toBeDefined();
  });
});

describe("Spin", () => {
  const spin = (input: Partial<Parameters<typeof spinDish>[0]> = {}) =>
    spinDish({ mode: "random", ingredients: [], collectionId: null, locale: "en", ...input });

  it("requires a session", async () => {
    expect(await spin()).toEqual({ serverError: "unauthorized" });
  });

  it("never repeats a dish within the day, and gives the spin back when nothing is left", async () => {
    const userId = await signedIn();
    await addDish("A", ["Rice"]);
    await addDish("B", ["Rice"]);
    const first = (await spin()).data!.dish.name;
    const second = (await spin()).data!.dish.name;
    expect(new Set([first, second])).toEqual(new Set(["A", "B"]));
    expect(await spin()).toEqual({ serverError: "not_found" });
    expect((await tries.usageFor(userId, "spins")).used).toBe(2);
  });

  it("on Free, the 4th spin of the day opens the upgrade sheet", async () => {
    await signedIn();
    for (const name of ["A", "B", "C", "D", "E"]) await addDish(name, ["Rice"]);
    for (let i = 0; i < 3; i++) expect((await spin()).data).toBeDefined();
    expect(await spin()).toEqual({ serverError: "quota_exceeded" });
  });

  it("with ingredients: all of them first, then any, and says which", async () => {
    await signedIn();
    await addDish("Chicken & potatoes", ["Chicken", "Potatoes"]);
    await addDish("Chicken soup", ["Chicken", "Carrots"]);
    const all = await spin({ mode: "ingredients", ingredients: ["chicken", "potato"] });
    expect(all.data).toMatchObject({ dish: { name: "Chicken & potatoes" }, matchMode: "all" });
    const any = await spin({ mode: "ingredients", ingredients: ["chicken", "potato"] });
    expect(any.data).toBeUndefined(); // "all" matched one dish, and it's been picked today
    const some = await spin({ mode: "ingredients", ingredients: ["carrots", "saffron"] });
    expect(some.data).toMatchObject({ dish: { name: "Chicken soup" }, matchMode: "any" });
  });

  it("can stay inside a collection, but never someone else's", async () => {
    await signedIn("amina@example.com");
    const inside = await addDish("Eid cookies", ["Flour"]);
    await addDish("Weeknight pasta", ["Pasta"]);
    const { data: collection } = await collections.createCollection({ name: "Eid" });
    await collections.setDishCollections({ dishId: inside, collectionIds: [collection!.id] });
    expect((await spin({ collectionId: collection!.id })).data?.dish.name).toBe("Eid cookies");

    await signedIn("karim@example.com");
    await addDish("Karim's dish", ["Rice"]);
    expect(await spin({ collectionId: collection!.id })).toEqual({ serverError: "not_found" });
  });
});
