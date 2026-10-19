import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { resetData } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const dishes = await import("@/server/actions/dishes");
const events = await import("@/server/actions/events");
const { search } = await import("@/server/actions/search");

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
}

const addDish = (name: string) =>
  dishes.createDish({
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

describe("global search", () => {
  it("requires a session and two characters", async () => {
    expect(await search({ q: "ta", locale: "en" })).toEqual({ serverError: "unauthorized" });
    await signedIn();
    expect((await search({ q: "t", locale: "en" })).validationErrors).toBeDefined();
  });

  it("finds the person's dishes despite typos and accents, plus Discover and events", async () => {
    await signedIn();
    await addDish("Chicken tagine");
    await addDish("Crème brûlée");
    await events.createEvent({ name: "Tagine night", date: "2026-12-12", guests: 6 });
    expect((await search({ q: "chiken", locale: "en" })).data?.dishes.map((d) => d.name)).toEqual(["Chicken tagine"]);
    expect((await search({ q: "creme brulee", locale: "en" })).data?.dishes.map((d) => d.name)).toEqual([
      "Crème brûlée",
    ]);
    const results = (await search({ q: "tagine", locale: "fr" })).data!;
    expect(results.events.map((e) => e.name)).toEqual(["Tagine night"]);
    expect(results.discover.length).toBeGreaterThan(0);
  });

  it("never shows someone else's dishes or events, and treats % and _ as plain text", async () => {
    await signedIn("amina@example.com");
    await addDish("Amina's harira");
    await signedIn("karim@example.com");
    const results = (await search({ q: "harira", locale: "en" })).data!;
    expect(results.dishes).toEqual([]);
    expect(results.events).toEqual([]);
    expect((await search({ q: "%%", locale: "en" })).data?.dishes).toEqual([]);
  });
});
