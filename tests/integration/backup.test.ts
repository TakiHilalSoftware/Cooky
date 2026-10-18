import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const backup = await import("@/server/actions/backup");
const dishes = await import("@/server/actions/dishes");
const collections = await import("@/server/actions/collections");
const { getBackupOverview } = await import("@/server/features/backup/queries");
const { runBackupImport } = await import("@/server/features/backup/service");
const { listMyDishes } = await import("@/server/features/dishes/queries");
const { drainOutbox } = await import("@/server/outbox/drain");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

async function signedIn(email = "amina@example.com", plan?: "plus") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  const userId = (await userByEmail(email))!.id;
  if (plan) await db().insert(schema.entitlements).values({ userId, plan, source: "comp", periodStart: new Date() });
  return userId;
}

function dishInput(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    difficulty: "easy" as const,
    course: "main" as const,
    servings: 4,
    seasons: ["winter" as const],
    dietaryTags: [],
    ingredients: [
      { name: "Lentils", amount: 250, unit: "g" as const, note: null },
      { name: "Salt", amount: null, unit: null, note: null },
    ],
    steps: [{ text: "Simmer.", timerMinutes: 30, prepDayBefore: false }],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    ...extra,
  };
}

const file = (items: unknown[]) => JSON.stringify({ format: "cooky-backup", version: 1, dishes: items });
const names = async () => ((await listMyDishes({ favorites: false }))?.dishes ?? []).map((d) => d.name).sort();

describe("exportBackup", () => {
  it("requires a session", async () => {
    expect(await backup.exportBackup()).toEqual({ serverError: "unauthorized" });
  });

  it("exports every live dish with its ingredients, steps, favorite, note and collections; nobody else's", async () => {
    await signedIn("karim@example.com");
    await dishes.createDish(dishInput("Karim's soup"));
    await signedIn();
    const { data: harira } = await dishes.createDish(dishInput("Harira"));
    const { data: gone } = await dishes.createDish(dishInput("Deleted one"));
    await dishes.deleteDish({ id: gone!.id });
    await dishes.setFavorite({ dishId: harira!.id, favorite: true });
    await dishes.saveDishNote({ dishId: harira!.id, text: "Less salt" });
    const { data: ramadan } = await collections.createCollection({ name: "Ramadan" });
    await collections.setDishCollections({ dishId: harira!.id, collectionIds: [ramadan!.id] });

    const { data } = await backup.exportBackup();
    expect(data?.filename).toMatch(/^cooky-recipes-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(data!.content);
    expect(parsed).toMatchObject({ format: "cooky-backup", version: 1 });
    expect(parsed.dishes).toEqual([
      expect.objectContaining({
        name: "Harira",
        servings: 4,
        seasons: ["winter"],
        ingredients: [
          { name: "Lentils", amount: 250, unit: "g", note: null },
          { name: "Salt", amount: null, unit: null, note: null },
        ],
        steps: [{ text: "Simmer.", timerMinutes: 30, prepDayBefore: false }],
        favorite: true,
        note: "Less salt",
        collections: ["Ramadan"],
      }),
    ]);
  });
});

describe("importBackup", () => {
  it("is a paid feature: Free gets plan_required (the upgrade sheet) and nothing is queued", async () => {
    await signedIn();
    expect(await backup.importBackup({ content: file([dishInput("Harira")]) })).toEqual({
      serverError: "plan_required",
    });
    expect(await db().select().from(schema.backupImports)).toEqual([]);
    expect((await getBackupOverview())?.canImport).toBe(false);
  });

  it("explains files it can't use, without queueing anything", async () => {
    await signedIn("amina@example.com", "plus");
    const result = async (content: string) => (await backup.importBackup({ content })).data;
    expect(await result("not json {")).toEqual({ status: "invalid", problem: "not_json" });
    expect(await result(JSON.stringify({ hello: "world" }))).toEqual({ status: "invalid", problem: "wrong_format" });
    expect(await result(JSON.stringify({ format: "cooky-backup", version: 2, dishes: [{}] }))).toEqual({
      status: "invalid",
      problem: "wrong_format",
    });
    expect(await result(file([]))).toEqual({ status: "invalid", problem: "empty" });
    expect(await result(file(Array.from({ length: 501 }, (_, i) => dishInput(`D${i}`))))).toEqual({
      status: "invalid",
      problem: "too_many",
    });
    // 5 MB is about bytes: 2.7 million Arabic letters are under 5 million characters but over 5 MB.
    expect(await result(file([dishInput("ا".repeat(2_700_000))]))).toEqual({ status: "invalid", problem: "too_large" });
    expect(await db().select().from(schema.backupImports)).toEqual([]);
  });

  it("queues one import at a time, then imports in the background: new dishes in, duplicates, broken ones and overflow out", async () => {
    const userId = await signedIn("amina@example.com", "plus");
    await dishes.createDish(dishInput("Harira"));

    const content = file([
      { ...dishInput("HARIRA"), favorite: true }, // same dish, other case: duplicate
      { ...dishInput("Couscous"), favorite: true, note: "Friday lunch", collections: ["Friday", "Family"] },
      { ...dishInput("Tagine"), collections: ["friday"] }, // same collection, other case
      { name: "", ingredients: [] }, // broken
    ]);
    expect(await backup.importBackup({ content })).toEqual({ data: { status: "queued", total: 4 } });
    expect(await backup.importBackup({ content })).toEqual({ data: { status: "busy" } });
    expect((await getBackupOverview())?.latestImport).toMatchObject({ status: "queued", total: 4 });

    await drainOutbox({ limit: 10 });

    expect(await names()).toEqual(["Couscous", "Harira", "Tagine"]);
    const overview = await getBackupOverview();
    expect(overview?.latestImport).toMatchObject({
      status: "done",
      total: 4,
      imported: 2,
      skipped: { duplicate: 1, full: 0, invalid: 1 },
    });
    const list = await listMyDishes({ favorites: false });
    expect(list?.collections.map((c) => [c.name, c.dishCount])).toEqual([
      ["Friday", 2],
      ["Family", 1],
    ]);
    expect(list?.dishes.find((d) => d.name === "Couscous")?.favorite).toBe(true);
    const [note] = await db().select().from(schema.dishNotes).where(eq(schema.dishNotes.userId, userId));
    expect(note?.text).toBe("Friday lunch");
    // The file's contents aren't kept once imported; only the summary is.
    const [row] = await db().select().from(schema.backupImports);
    expect(row?.dishes).toBeNull();
  });

  it("stops at the plan's dish cap and says how many didn't fit", async () => {
    const userId = await signedIn("amina@example.com", "plus");
    // Plus holds 500: fill to 498 directly, then import 4.
    await db()
      .insert(schema.dishes)
      .values(
        Array.from({ length: 498 }, (_, i) => ({
          userId,
          name: `Dish ${i}`,
          difficulty: "easy" as const,
          course: "main" as const,
          servings: 2,
        })),
      );
    await backup.importBackup({ content: file(["A", "B", "C", "D"].map((n) => dishInput(`New ${n}`))) });
    await drainOutbox({ limit: 10 });
    expect((await getBackupOverview())?.latestImport).toMatchObject({ imported: 2, skipped: { full: 2 } });
    expect((await listMyDishes({ favorites: false }))?.allowance.count).toBe(500);
  });

  it("running the job again (a retry after a crash) changes nothing", async () => {
    await signedIn("amina@example.com", "plus");
    await backup.importBackup({ content: file([dishInput("Couscous")]) });
    await drainOutbox({ limit: 10 });
    const [row] = await db().select().from(schema.backupImports);
    await runBackupImport(row!.id);
    expect(await names()).toEqual(["Couscous"]);
  });
});
