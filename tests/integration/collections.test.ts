import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const collections = await import("@/server/actions/collections");
const dishes = await import("@/server/actions/dishes");
const { getDish, listMyDishes } = await import("@/server/features/dishes/queries");
const { purgeDeleted } = await import("@/server/features/dishes/cleanup");

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

async function addDish(name: string) {
  const { data } = await dishes.createDish({
    name,
    difficulty: "easy",
    course: "main",
    servings: 2,
    seasons: [],
    dietaryTags: [],
    ingredients: [{ name: "Salt", amount: null, unit: null, note: null }],
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  return data!.id;
}

async function newCollection(name: string) {
  const result = await collections.createCollection({ name });
  if (!result.data) throw new Error(JSON.stringify(result));
  return result.data.id;
}

const list = (filters: Record<string, unknown> = {}) => listMyDishes({ favorites: false, ...filters });

describe("createCollection", () => {
  it("requires a session", async () => {
    expect(await collections.createCollection({ name: "Ramadan" })).toEqual({ serverError: "unauthorized" });
  });

  it("creates a trimmed, named collection; the same name twice (any case) is a conflict", async () => {
    await signedIn();
    expect((await collections.createCollection({ name: "  Ramadan  " })).data).toMatchObject({ name: "Ramadan" });
    expect(await collections.createCollection({ name: "ramadan" })).toEqual({ serverError: "conflict" });
    expect((await collections.createCollection({ name: "   " })).validationErrors).toBeDefined();
  });

  it("Free holds 3 (plan_limits); the 4th says quota_exceeded, and parallel creates can't get around it", async () => {
    await signedIn();
    await newCollection("One");
    const results = await Promise.all(
      ["Two", "Three", "Four", "Five"].map((name) => collections.createCollection({ name })),
    );
    expect(results.filter((r) => r.data)).toHaveLength(2);
    expect(results.filter((r) => r.serverError === "quota_exceeded")).toHaveLength(2);
    expect((await list())?.collectionAllowance).toEqual({ count: 3, limit: 3, canAdd: false });
  });

  it("paid plans have no cap", async () => {
    const userId = await signedIn();
    await db().insert(schema.entitlements).values({ userId, plan: "plus", source: "comp", periodStart: new Date() });
    for (const name of ["A", "B", "C", "D", "E"]) await newCollection(name);
    expect((await list())?.collectionAllowance).toEqual({ count: 5, limit: null, canAdd: true });
  });
});

describe("renaming, deleting and Undo", () => {
  it("renames, refusing a name that's taken", async () => {
    await signedIn();
    const id = await newCollection("Ramadan");
    await newCollection("Kids");
    expect(await collections.renameCollection({ id, name: "Iftar" })).toEqual({ data: { id, name: "Iftar" } });
    expect(await collections.renameCollection({ id, name: "KIDS" })).toEqual({ serverError: "conflict" });
    // Renaming to its own name (another case) is fine.
    expect((await collections.renameCollection({ id, name: "IFTAR" })).data).toBeDefined();
  });

  it("deleting keeps the dishes; Undo brings the collection back with them", async () => {
    await signedIn();
    const dish = await addDish("Harira");
    const id = await newCollection("Ramadan");
    await collections.setDishCollections({ dishId: dish, collectionIds: [id] });
    expect(await collections.deleteCollection({ id })).toEqual({ data: { id, name: "Ramadan" } });
    expect((await list())?.collections).toEqual([]);
    expect((await list())?.total).toBe(1);

    expect(await collections.restoreCollection({ id })).toEqual({ data: { id } });
    expect((await list())?.collections).toEqual([{ id, name: "Ramadan", dishCount: 1 }]);
  });

  it("Undo refuses when the name was reused or the plan is full meanwhile", async () => {
    await signedIn();
    const first = await newCollection("Ramadan");
    await collections.deleteCollection({ id: first });
    await newCollection("Ramadan");
    expect(await collections.restoreCollection({ id: first })).toEqual({ serverError: "conflict" });

    const second = await newCollection("Kids");
    await collections.deleteCollection({ id: second });
    await newCollection("Weeknights");
    await newCollection("Eid");
    expect(await collections.restoreCollection({ id: second })).toEqual({ serverError: "quota_exceeded" });
  });

  it("the cleanup job removes collections deleted over a day ago, not their dishes", async () => {
    await signedIn();
    const dish = await addDish("Harira");
    const id = await newCollection("Ramadan");
    await collections.setDishCollections({ dishId: dish, collectionIds: [id] });
    await collections.deleteCollection({ id });
    await db()
      .update(schema.collections)
      .set({ deletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(schema.collections.id, id));
    expect(await purgeDeleted()).toEqual({ dishes: 0, collections: 1, imports: 0, messages: 0 });
    expect(await db().select().from(schema.collectionDishes)).toEqual([]);
    expect(await getDish(dish)).not.toBeNull();
  });
});

describe("setDishCollections", () => {
  it("puts a dish in exactly the chosen collections, and the box filters and counts by them", async () => {
    await signedIn();
    const harira = await addDish("Harira");
    const tagine = await addDish("Tagine");
    const ramadan = await newCollection("Ramadan");
    const friday = await newCollection("Friday");

    await collections.setDishCollections({ dishId: harira, collectionIds: [ramadan, friday] });
    await collections.setDishCollections({ dishId: tagine, collectionIds: [friday] });
    expect((await getDish(harira))?.collectionIds.sort()).toEqual([ramadan, friday].sort());

    await collections.setDishCollections({ dishId: harira, collectionIds: [ramadan] });
    const all = await list();
    expect(all?.collections).toEqual([
      { id: ramadan, name: "Ramadan", dishCount: 1 },
      { id: friday, name: "Friday", dishCount: 1 },
    ]);
    const inFriday = await list({ collection: friday });
    expect(inFriday?.activeCollection).toMatchObject({ id: friday });
    expect(inFriday?.dishes.map((d) => d.name)).toEqual(["Tagine"]);

    // A deleted dish doesn't count.
    await dishes.deleteDish({ id: tagine });
    expect((await list())?.collections.find((c) => c.id === friday)?.dishCount).toBe(0);
  });

  it("someone else's dish or collection is refused, and their collection id is no filter", async () => {
    await signedIn("karim@example.com");
    const theirDish = await addDish("Karim's dish");
    const theirs = await newCollection("Karim's");
    await signedIn("amina@example.com");
    const mine = await addDish("Harira");

    expect(await collections.setDishCollections({ dishId: theirDish, collectionIds: [] })).toEqual({
      serverError: "not_found",
    });
    expect(await collections.setDishCollections({ dishId: mine, collectionIds: [theirs] })).toEqual({
      serverError: "not_found",
    });
    expect(await collections.renameCollection({ id: theirs, name: "Mine" })).toEqual({ serverError: "not_found" });
    expect(await collections.deleteCollection({ id: theirs })).toEqual({ serverError: "not_found" });
    const filtered = await list({ collection: theirs });
    expect(filtered?.activeCollection).toBeNull();
    expect(filtered?.dishes.map((d) => d.name)).toEqual(["Harira"]);
    expect(await db().select().from(schema.collectionDishes)).toEqual([]);
  });
});
