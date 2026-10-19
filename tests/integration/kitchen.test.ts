import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const kitchen = await import("@/server/actions/kitchen");
const settings = await import("@/server/actions/settings");
const { getPantry, loadPantryLines } = await import("@/server/features/kitchen/queries");
const { PANTRY_LIMIT } = await import("@/server/features/kitchen/service");

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

const names = async (locale: "en" | "fr" | "ar" = "en") =>
  (await getPantry(locale))!.items.map((i) => `${i.name}${i.isStaple ? "*" : ""}`);

describe("My kitchen", () => {
  it("requires a session", async () => {
    expect(await kitchen.addPantryItems({ names: ["Salt"] })).toEqual({ serverError: "unauthorized" });
  });

  it("adds items once, whatever language or spelling they're typed in, and shows them in the viewer's language", async () => {
    await signedIn();
    await kitchen.addPantryItems({ names: ["Tomatoes", "tomate", "طماطم"] });
    await kitchen.addPantryItems({ names: ["Grandma's spice mix"] });
    await kitchen.addPantryItems({ names: ["grandma's  SPICE mix"] });
    expect(await names("en")).toEqual(["Tomato", "Grandma's spice mix"]);
    expect((await names("fr"))[0]).toBe("Tomate");
  });

  it("marks staples, and adding a staple again as a plain item never demotes it", async () => {
    await signedIn();
    await kitchen.addPantryItems({ names: ["Salt"], staple: true });
    await kitchen.addPantryItems({ names: ["salt"] });
    expect(await names()).toEqual(["Salt*"]);
    const [salt] = (await getPantry("en"))!.items;
    await kitchen.setPantryStaple({ id: salt!.id, staple: false });
    expect(await names()).toEqual(["Salt"]);
  });

  it("offers common staples that aren't in the kitchen yet", async () => {
    await signedIn();
    const before = (await getPantry("en"))!.suggestedStaples;
    expect(before.length).toBeGreaterThan(3);
    await kitchen.addPantryItems({ names: [before[0]!], staple: true });
    expect((await getPantry("en"))!.suggestedStaples).not.toContain(before[0]);
  });

  it("removes an item and returns what Undo needs; someone else's item looks missing", async () => {
    await signedIn("amina@example.com");
    await kitchen.addPantryItems({ names: ["Olive oil"], staple: true });
    const [item] = (await getPantry("en"))!.items;
    await signedIn("karim@example.com");
    expect(await kitchen.removePantryItem({ id: item!.id })).toEqual({ serverError: "not_found" });
    expect(await kitchen.setPantryStaple({ id: item!.id, staple: false })).toEqual({ serverError: "not_found" });
    await logIn("amina@example.com");
    expect((await kitchen.removePantryItem({ id: item!.id })).data).toEqual({ name: "Olive oil", isStaple: true });
    expect(await names()).toEqual([]);
  });

  it(`holds at most ${PANTRY_LIMIT} items, even when adds race`, async () => {
    const userId = await signedIn();
    await db()
      .insert(schema.pantryItems)
      .values(Array.from({ length: PANTRY_LIMIT - 1 }, (_, i) => ({ userId, name: `item ${i}`, key: `n:item ${i}` })));
    const results = await Promise.all([
      kitchen.addPantryItems({ names: ["Lentils"] }),
      kitchen.addPantryItems({ names: ["Chickpeas"] }),
    ]);
    expect(results.filter((r) => r.data)).toHaveLength(1);
    expect(results.filter((r) => r.serverError === "conflict")).toHaveLength(1);
    // Re-adding something already there still works when full.
    expect((await kitchen.addPantryItems({ names: ["item 3"] })).data).toBeDefined();
  });

  it("gives the matcher every language's name for dictionary items", async () => {
    const userId = await signedIn();
    await kitchen.addPantryItems({ names: ["chickpeas"] });
    const [line] = await loadPantryLines(userId);
    expect(line?.ingredientId).not.toBeNull();
    expect(line?.names).toEqual(expect.arrayContaining(["chickpeas", "Pois chiches"]));
  });
});

describe("starter pack staples", () => {
  it("saves the ticked staples as always have", async () => {
    await signedIn();
    await settings.completeOnboarding({
      city: null,
      latitude: null,
      longitude: null,
      dietaryPrefs: [],
      locale: "en",
      favorites: [],
      staples: ["Salt", "Olive oil"],
    });
    expect((await names()).sort()).toEqual(["Olive oil*", "Salt*"]);
  });
});
