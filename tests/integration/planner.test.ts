import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const dishes = await import("@/server/actions/dishes");
const planner = await import("@/server/actions/planner");
const cook = await import("@/server/actions/cook");
const { getPlanner, getCalendar } = await import("@/server/features/planner/queries");
const { addDays, dayIn, weekStartOf } = await import("@/lib/dates");

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
    servings: 4,
    seasons: [],
    dietaryTags: [],
    ingredients: [{ name: "Rice", amount: null, unit: null, note: null }],
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  return data!.id;
}

const today = () => dayIn("UTC");
const monday = () => weekStartOf(today());

describe("planner", () => {
  it("requires a session", async () => {
    expect(await planner.addPlannedMeal({ dishId: crypto.randomUUID(), date: today() })).toEqual({
      serverError: "unauthorized",
    });
  });

  it("plans, moves and removes meals, and shows them on the week", async () => {
    await signedIn();
    const tagine = await addDish("Tagine");
    const { data: meal } = await planner.addPlannedMeal({ dishId: tagine, date: monday(), mealSlot: "dinner" });
    expect(meal).toMatchObject({ dishId: tagine, date: monday(), mealSlot: "dinner" });

    let week = (await getPlanner(undefined, "en"))!;
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toBe(monday());
    expect(week.meals.map((m) => [m.name, m.date, m.mealSlot])).toEqual([["Tagine", monday(), "dinner"]]);
    expect(week.library.map((d) => d.name)).toEqual(["Tagine"]);

    await planner.movePlannedMeal({ id: meal!.id, date: addDays(monday(), 2), mealSlot: "lunch" });
    week = (await getPlanner(undefined, "en"))!;
    expect(week.meals[0]).toMatchObject({ date: addDays(monday(), 2), mealSlot: "lunch" });

    expect((await planner.removePlannedMeal({ id: meal!.id })).data).toEqual({
      dishId: tagine,
      date: addDays(monday(), 2),
      mealSlot: "lunch",
    });
    expect((await getPlanner(undefined, "en"))!.meals).toEqual([]);
  });

  it("copies last week onto this week once, skipping exact repeats", async () => {
    await signedIn();
    const a = await addDish("A");
    const b = await addDish("B");
    const lastMonday = addDays(monday(), -7);
    await planner.addPlannedMeal({ dishId: a, date: lastMonday });
    await planner.addPlannedMeal({ dishId: b, date: addDays(lastMonday, 3), mealSlot: "lunch" });
    expect((await getPlanner(undefined, "en"))!.lastWeekCount).toBe(2);

    expect((await planner.copyPlannerWeek({ from: lastMonday, to: monday() })).data).toEqual({ copied: 2 });
    expect((await planner.copyPlannerWeek({ from: lastMonday, to: monday() })).data).toEqual({ copied: 0 });
    const meals = (await getPlanner(undefined, "en"))!.meals;
    expect(meals.map((m) => [m.name, m.date, m.mealSlot])).toEqual([
      ["A", monday(), null],
      ["B", addDays(monday(), 3), "lunch"],
    ]);
  });

  it("repeats a meal on the days picked, never twice on one day", async () => {
    await signedIn();
    const a = await addDish("A");
    const { data: meal } = await planner.addPlannedMeal({ dishId: a, date: monday(), mealSlot: "breakfast" });
    const days = [addDays(monday(), 1), addDays(monday(), 2)];
    expect((await planner.repeatPlannedMeal({ id: meal!.id, dates: [...days, monday()] })).data).toEqual({ added: 2 });
    expect((await planner.repeatPlannedMeal({ id: meal!.id, dates: days })).data).toEqual({ added: 0 });
    expect((await getPlanner(undefined, "en"))!.meals.every((m) => m.mealSlot === "breakfast")).toBe(true);
  });

  it("refuses someone else's dish or meal, dates out of reach, and a full day", async () => {
    const userId = await signedIn("amina@example.com");
    const mine = await addDish("Mine");
    const { data: meal } = await planner.addPlannedMeal({ dishId: mine, date: today() });
    await signedIn("karim@example.com");
    expect(await planner.addPlannedMeal({ dishId: mine, date: today() })).toEqual({ serverError: "not_found" });
    expect(await planner.movePlannedMeal({ id: meal!.id, date: today() })).toEqual({ serverError: "not_found" });
    expect(await planner.removePlannedMeal({ id: meal!.id })).toEqual({ serverError: "not_found" });

    await logIn("amina@example.com");
    expect(await planner.addPlannedMeal({ dishId: mine, date: addDays(today(), 800) })).toEqual({
      serverError: "invalid",
    });
    expect((await planner.addPlannedMeal({ dishId: mine, date: "2026-02-30" })).validationErrors).toBeDefined();
    const busy = addDays(today(), 5);
    await db()
      .insert(schema.plannedMeals)
      .values(Array.from({ length: 20 }, () => ({ userId, dishId: mine, date: busy })));
    expect(await planner.addPlannedMeal({ dishId: mine, date: busy })).toEqual({ serverError: "conflict" });
  });

  it("hides meals of a deleted dish", async () => {
    await signedIn();
    const gone = await addDish("Gone");
    await planner.addPlannedMeal({ dishId: gone, date: today() });
    await dishes.deleteDish({ id: gone });
    expect((await getPlanner(undefined, "en"))!.meals).toEqual([]);
  });
});

describe("calendar", () => {
  it("shows planned and cooked meals on the month, and both can move or come back after removal", async () => {
    await signedIn();
    const soup = await addDish("Soup");
    await planner.addPlannedMeal({ dishId: soup, date: today() });
    const { data: entry } = await cook.logCook({ dishId: soup });

    const month = (await getCalendar(undefined, "en"))!;
    expect(month.month).toBe(today().slice(0, 7));
    expect(month.days.length % 7).toBe(0);
    expect(month.entries.map((e) => [e.kind, e.name, e.date])).toEqual([
      ["planned", "Soup", today()],
      ["cooked", "Soup", today()],
    ]);

    const yesterday = addDays(today(), -1);
    expect((await planner.moveCookLog({ id: entry!.id, date: yesterday })).data).toEqual({
      id: entry!.id,
      date: yesterday,
    });
    await cook.undoLogCook({ id: entry!.id });
    const { data: restored } = await planner.restoreCookLog({
      dishId: soup,
      date: yesterday,
      mealSlot: null,
      source: "cook",
    });
    expect(restored?.id).toBeDefined();
    const after = (await getCalendar(yesterday.slice(0, 7), "en"))!;
    expect(after.entries.find((e) => e.kind === "cooked")?.date).toBe(yesterday);
  });
});
