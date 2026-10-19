import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const settings = await import("@/server/actions/settings");
const { getKitchen } = await import("@/server/features/profile/queries");
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

const kitchen = { city: "Casablanca", latitude: 33.573109, longitude: -7.589843, dietaryPrefs: ["halal" as const] };

describe("updateKitchen", () => {
  it("requires a session", async () => {
    expect(await settings.updateKitchen(kitchen)).toEqual({ serverError: "unauthorized" });
  });

  it("saves the city, rounds the location to about 1 km, and keeps the diet", async () => {
    await signedIn();
    expect((await settings.updateKitchen(kitchen)).data).toEqual({
      city: "Casablanca",
      latitude: 33.57,
      longitude: -7.59,
      dietaryPrefs: ["halal"],
    });
    expect(await getKitchen()).toEqual({
      city: "Casablanca",
      latitude: 33.57,
      longitude: -7.59,
      dietaryPrefs: ["halal"],
      onboarded: false,
    });
  });

  it("clears an empty city and refuses impossible values", async () => {
    await signedIn();
    await settings.updateKitchen({ ...kitchen, city: "   ", latitude: null, longitude: null });
    expect(await getKitchen()).toMatchObject({ city: null, latitude: null });
    expect((await settings.updateKitchen({ ...kitchen, city: "x".repeat(81) })).validationErrors).toBeDefined();
    expect((await settings.updateKitchen({ ...kitchen, latitude: 91 })).validationErrors).toBeDefined();
    expect(
      (await settings.updateKitchen({ ...kitchen, dietaryPrefs: ["halal", "halal"] })).validationErrors,
    ).toBeDefined();
  });
});

describe("completeOnboarding", () => {
  it("saves the kitchen, puts the picks in the box as favorites, and marks onboarding done", async () => {
    const userId = await signedIn();
    const result = await settings.completeOnboarding({
      ...kitchen,
      locale: "fr",
      favorites: ["harira", "hummus", "tabbouleh", "no-such-dish"],
    });
    expect(result.data).toEqual({ saved: 3 });
    const list = await listMyDishes({ favorites: true }, "fr");
    expect(list?.dishes.map((d) => d.name).sort()).toEqual(["Harira", "Houmous", "Taboulé libanais"]);
    expect(await getKitchen()).toMatchObject({ city: "Casablanca", onboarded: true });
    const [profile] = await db().select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    expect(profile?.onboardedAt).toBeInstanceOf(Date);
  });

  it("running it again doesn't duplicate dishes", async () => {
    await signedIn();
    await settings.completeOnboarding({ ...kitchen, locale: "en", favorites: ["harira"] });
    await settings.completeOnboarding({ ...kitchen, locale: "en", favorites: ["harira", "hummus"] });
    expect((await listMyDishes({ favorites: false }))?.total).toBe(2);
  });

  it("picks that don't fit the plan's dish cap are skipped, the rest still finishes", async () => {
    const userId = await signedIn();
    await db()
      .insert(schema.dishes)
      .values(
        Array.from({ length: 49 }, (_, i) => ({
          userId,
          name: `D${i}`,
          difficulty: "easy" as const,
          course: "main" as const,
          servings: 2,
        })),
      );
    const result = await settings.completeOnboarding({ ...kitchen, locale: "en", favorites: ["harira", "hummus"] });
    expect(result.data).toEqual({ saved: 1 });
    expect(await getKitchen()).toMatchObject({ onboarded: true });
  });

  it("skipping marks it done without touching anything else", async () => {
    await signedIn();
    await settings.skipOnboarding();
    expect(await getKitchen()).toEqual({
      city: null,
      latitude: null,
      longitude: null,
      dietaryPrefs: [],
      onboarded: true,
    });
    expect((await listMyDishes({ favorites: false }))?.total).toBe(0);
  });

  it("requires a session", async () => {
    expect(await settings.completeOnboarding({ ...kitchen, locale: "en", favorites: [] })).toEqual({
      serverError: "unauthorized",
    });
    expect(await settings.skipOnboarding()).toEqual({ serverError: "unauthorized" });
  });
});
