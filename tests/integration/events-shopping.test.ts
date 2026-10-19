import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { aiHandlers, fakeGroq } from "./support/ai";
import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const dishes = await import("@/server/actions/dishes");
const events = await import("@/server/actions/events");
const shopping = await import("@/server/actions/shopping");
const kitchen = await import("@/server/actions/kitchen");
const planner = await import("@/server/actions/planner");
const { getEvent, getEvents } = await import("@/server/features/events/queries");
const { getShoppingList } = await import("@/server/features/shopping/queries");
const { getPantry } = await import("@/server/features/kitchen/queries");
const tries = await import("@/server/quota/tries");
const { addDays, dayIn, weekStartOf } = await import("@/lib/dates");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeGroq.reset();
  hibp.use(...aiHandlers);
});

async function signedIn(email = "amina@example.com", plan?: "plus" | "pro") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  const userId = (await userByEmail(email))!.id;
  if (plan) await db().insert(schema.entitlements).values({ userId, plan, source: "comp", periodStart: new Date() });
  return userId;
}

type Line = { name: string; amount: number | null; unit: "g" | "kg" | "piece" | "tbsp" | "tsp" | null };
async function addDish(
  name: string,
  ingredients: Line[],
  extra: { course?: "main" | "dessert"; servings?: number } = {},
) {
  const { data } = await dishes.createDish({
    name,
    difficulty: "easy",
    course: extra.course ?? "main",
    servings: extra.servings ?? 4,
    seasons: [],
    dietaryTags: [],
    ingredients: ingredients.map((i) => ({ ...i, note: null })),
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  return data!.id;
}

const today = () => dayIn("UTC");
const listOf = async () =>
  (await getShoppingList("en"))!.items.map((i) =>
    `${i.amount ?? ""}${i.unit ?? ""} ${i.name}${i.checked ? " ✓" : ""}`.trim(),
  );

describe("events", () => {
  it("creates, edits and deletes events; the menu goes with them", async () => {
    await signedIn();
    const tagine = await addDish("Tagine", [{ name: "Chicken", amount: 1, unit: "kg" }]);
    const { data } = await events.createEvent({ name: "Friday dinner", date: addDays(today(), 3), guests: 8 });
    await events.setEventDish({ eventId: data!.id, course: "main", dishId: tagine });
    const event = (await getEvent(data!.id, "en"))!;
    expect(event).toMatchObject({ name: "Friday dinner", guests: 8 });
    expect(event.courses.find((c) => c.course === "main")?.dish).toMatchObject({ name: "Tagine", servings: 4 });

    await events.updateEvent({ id: data!.id, name: "Saturday dinner", date: addDays(today(), 4), guests: 10 });
    expect((await getEvents())!.upcoming[0]).toMatchObject({ name: "Saturday dinner", guests: 10, courses: 1 });

    await events.deleteEvent({ id: data!.id });
    expect(await db().select().from(schema.eventDishes)).toHaveLength(0);
  });

  it("on Free, a third upcoming event opens the upgrade sheet; past ones don't count", async () => {
    await signedIn();
    for (const days of [1, 2]) await events.createEvent({ name: `E${days}`, date: addDays(today(), days), guests: 4 });
    expect(await events.createEvent({ name: "E3", date: addDays(today(), 3), guests: 4 })).toEqual({
      serverError: "quota_exceeded",
    });
    const { data: past } = await events.createEvent({ name: "Last month", date: addDays(today(), -30), guests: 4 });
    expect(past).toBeDefined();
    // Moving the past one into the future would be a third upcoming event.
    expect(
      await events.updateEvent({ id: past!.id, name: "Last month", date: addDays(today(), 5), guests: 4 }),
    ).toEqual({
      serverError: "quota_exceeded",
    });
    expect((await getEvents())!.allowance).toMatchObject({ count: 2, limit: 2, canAdd: false });
  });

  it("refuses guests outside 1–500 and someone else's dish or event", async () => {
    await signedIn("amina@example.com");
    const mine = await addDish("Mine", [{ name: "Rice", amount: null, unit: null }]);
    const { data } = await events.createEvent({ name: "Lunch", date: today(), guests: 2 });
    expect((await events.createEvent({ name: "Too many", date: today(), guests: 501 })).validationErrors).toBeDefined();
    await signedIn("karim@example.com");
    expect(await events.setEventDish({ eventId: data!.id, course: "main", dishId: null })).toEqual({
      serverError: "not_found",
    });
    const { data: his } = await events.createEvent({ name: "His", date: today(), guests: 2 });
    expect(await events.setEventDish({ eventId: his!.id, course: "main", dishId: mine })).toEqual({
      serverError: "not_found",
    });
  });

  it("Suggest picks the person's own dish for the course, and moves on when asked again", async () => {
    await signedIn();
    const a = await addDish("Baklava", [{ name: "Filo", amount: null, unit: null }], { course: "dessert" });
    const b = await addDish("Kunafa", [{ name: "Kataifi", amount: null, unit: null }], { course: "dessert" });
    await addDish("Tagine", [{ name: "Chicken", amount: null, unit: null }]);
    const { data: event } = await events.createEvent({ name: "Eid", date: today(), guests: 12 });
    const first = await events.suggestCourse({ eventId: event!.id, course: "dessert", exclude: [], locale: "en" });
    expect(first.data).toMatchObject({ kind: "mine" });
    const firstId = first.data!.kind === "mine" ? first.data!.dishId : "";
    const second = await events.suggestCourse({
      eventId: event!.id,
      course: "dessert",
      exclude: [firstId],
      locale: "en",
    });
    expect(second.data?.kind === "mine" && second.data.dishId).toBe(firstId === a ? b : a);
    expect(
      await events.suggestCourse({ eventId: event!.id, course: "dessert", exclude: [a, b], locale: "en" }),
    ).toEqual({ serverError: "not_found" });
  });

  it("AI Suggest is for paid plans (the try comes back on Free) and only picks real candidates", async () => {
    const freeUser = await signedIn("free@example.com");
    const { data: event } = await events.createEvent({ name: "Dinner", date: today(), guests: 4 });
    expect(await events.suggestCourseWithAi({ eventId: event!.id, course: "main", exclude: [], locale: "en" })).toEqual(
      { serverError: "plan_required" },
    );
    expect((await tries.usageFor(freeUser, "assistant")).used).toBe(0);

    await signedIn("plus@example.com", "plus");
    const tagine = await addDish("Tagine", [{ name: "Chicken", amount: null, unit: null }]);
    const { data: plusEvent } = await events.createEvent({ name: "Dinner", date: today(), guests: 4 });
    fakeGroq.answer = { id: "m1", why: "A crowd-pleaser" };
    const { data } = await events.suggestCourseWithAi({
      eventId: plusEvent!.id,
      course: "main",
      exclude: [],
      locale: "en",
    });
    expect(data).toMatchObject({ kind: "mine", dishId: tagine, why: "A crowd-pleaser" });
    fakeGroq.answer = { id: "m77", why: "Invented" };
    expect(
      await events.suggestCourseWithAi({ eventId: plusEvent!.id, course: "main", exclude: [], locale: "en" }),
    ).toEqual({ serverError: "not_found" });
  });
});

describe("shopping list", () => {
  it("merges the same ingredient across dishes, scales, and skips staples", async () => {
    await signedIn();
    await kitchen.addPantryItems({ names: ["salt"], staple: true });
    const soup = await addDish("Soup", [
      { name: "Onions", amount: 2, unit: null },
      { name: "Lentils", amount: 250, unit: "g" },
      { name: "Salt", amount: null, unit: null },
    ]);
    const tagine = await addDish(
      "Tagine",
      [
        { name: "onion", amount: 3, unit: null },
        { name: "Lentils", amount: 1, unit: "kg" },
      ],
      { servings: 2 },
    );
    const first = await shopping.addToShopping({ source: "dish", id: soup, servings: 8 });
    expect(first.data).toEqual({ added: 2, skippedStaples: 1 });
    await shopping.addToShopping({ source: "dish", id: tagine });
    expect(await listOf()).toEqual(["7 Onion", "1.5kg Lentils"]);
    expect((await getShoppingList("en"))!.items[0]?.dishCount).toBe(2);
  });

  it("shops for an event (scaled to the guests) and for a planner week", async () => {
    await signedIn();
    const cake = await addDish("Cake", [{ name: "Flour", amount: 200, unit: "g" }], { course: "dessert", servings: 4 });
    const { data: event } = await events.createEvent({ name: "Party", date: today(), guests: 10 });
    await events.setEventDish({ eventId: event!.id, course: "dessert", dishId: cake });
    await shopping.addToShopping({ source: "event", id: event!.id });
    expect(await listOf()).toEqual(["500g Flour"]);

    await planner.addPlannedMeal({ dishId: cake, date: today() });
    await shopping.addToShopping({ source: "week", weekStart: weekStartOf(today()) });
    expect(await listOf()).toEqual(["700g Flour"]);
  });

  it("ticks are last-write-wins, so an old offline replay never undoes a newer change", async () => {
    await signedIn();
    await shopping.addShoppingItem({ name: "Paper towels" });
    const [item] = (await getShoppingList("en"))!.items;
    const version = (await getShoppingList("en"))!.version;
    expect(
      (await shopping.toggleShoppingItem({ id: item!.id, checked: true, at: "2026-10-19T10:00:00.000Z" })).data,
    ).toEqual({
      applied: true,
    });
    expect(
      (await shopping.toggleShoppingItem({ id: item!.id, checked: false, at: "2026-10-19T09:00:00.000Z" })).data,
    ).toEqual({
      applied: false,
    });
    expect(await listOf()).toEqual(["Paper towels ✓"]);
    expect((await getShoppingList("en"))!.version).toBe(version + 1);
  });

  it("removes with Undo, merges typed items into recipe items, and keeps lists private", async () => {
    await signedIn("amina@example.com");
    const soup = await addDish("Soup", [{ name: "Onions", amount: 2, unit: null }]);
    await shopping.addToShopping({ source: "dish", id: soup });
    await shopping.addShoppingItem({ name: "onion" });
    expect(await listOf()).toEqual(["2 Onion"]);
    const [onion] = (await getShoppingList("en"))!.items;
    const { data: removed } = await shopping.removeShoppingItem({ id: onion!.id });
    expect(await listOf()).toEqual([]);
    await shopping.restoreShoppingItem(removed!);
    expect(await listOf()).toEqual(["2 Onion"]);

    const [again] = (await getShoppingList("en"))!.items;
    await signedIn("karim@example.com");
    expect(await shopping.toggleShoppingItem({ id: again!.id, checked: true, at: new Date().toISOString() })).toEqual({
      serverError: "not_found",
    });
    expect(await shopping.removeShoppingItem({ id: again!.id })).toEqual({ serverError: "not_found" });
  });

  it("'Done shopping' clears what was bought and can stock My kitchen (food only)", async () => {
    await signedIn();
    const soup = await addDish("Soup", [
      { name: "Lentils", amount: 250, unit: "g" },
      { name: "Carrots", amount: 2, unit: null },
    ]);
    await shopping.addToShopping({ source: "dish", id: soup });
    await shopping.addShoppingItem({ name: "Paper towels" });
    const items = (await getShoppingList("en"))!.items;
    for (const item of items.filter((i) => i.name !== "Carrot")) {
      await shopping.toggleShoppingItem({ id: item.id, checked: true, at: new Date().toISOString() });
    }
    expect((await shopping.doneShopping({ addToKitchen: true })).data).toEqual({ bought: 2, addedToKitchen: 1 });
    expect(await listOf()).toEqual(["2 Carrot"]);
    expect((await getPantry("en"))!.items.map((i) => i.name)).toEqual(["Lentils"]);

    await shopping.clearShoppingList({ scope: "all" });
    expect(await listOf()).toEqual([]);
    const [list] = await db().select().from(schema.shoppingLists);
    expect(
      await db().select().from(schema.shoppingItems).where(eq(schema.shoppingItems.listId, list!.id)),
    ).toHaveLength(0);
  });
});
