import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const feed = await import("@/server/actions/calendar-feed");
const household = await import("@/server/actions/household");
const shopping = await import("@/server/actions/shopping");
const dishes = await import("@/server/actions/dishes");
const planner = await import("@/server/actions/planner");
const events = await import("@/server/actions/events");
const { getShoppingList } = await import("@/server/features/shopping/queries");
const { GET } = await import("@/app/api/calendar/[token]/route");
const { dayIn } = await import("@/lib/dates");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

async function signedIn(email: string, plan?: "plus" | "pro") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  const userId = (await userByEmail(email))!.id;
  if (plan) await db().insert(schema.entitlements).values({ userId, plan, source: "comp", periodStart: new Date() });
  return userId;
}

async function fetchFeed(url: string) {
  const token = url.split("/api/calendar/")[1]!;
  return GET(new Request(url), { params: Promise.resolve({ token }) });
}

const names = async () => (await getShoppingList("en"))!.items.map((i) => i.name);

describe("iCal feed (Pro)", () => {
  it("is Pro only", async () => {
    await signedIn("plus@example.com", "plus");
    expect(await feed.createCalendarFeed({})).toEqual({ serverError: "plan_required" });
  });

  it("serves planned meals and events behind a secret, revocable link", async () => {
    const userId = await signedIn("pro@example.com", "pro");
    const { data: dish } = await dishes.createDish({
      name: "Couscous",
      difficulty: "easy",
      course: "main",
      servings: 4,
      seasons: [],
      dietaryTags: [],
      ingredients: [{ name: "Semolina", amount: null, unit: null, note: null }],
      steps: [],
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    await planner.addPlannedMeal({ dishId: dish!.id, date: dayIn("UTC") });
    await events.createEvent({ name: "Eid lunch", date: dayIn("UTC"), guests: 12 });

    const { data } = await feed.createCalendarFeed({});
    const response = await fetchFeed(data!.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Couscous");
    expect(body).toContain("SUMMARY:Eid lunch");
    expect(body).not.toContain("pro@example.com");

    // Only the hash is stored.
    const [row] = await db().select().from(schema.calendarFeeds).where(eq(schema.calendarFeeds.userId, userId));
    expect(data!.url).not.toContain(row!.tokenHash);

    // A new link replaces the old one; turning it off stops it; so does losing Pro.
    const { data: second } = await feed.createCalendarFeed({});
    expect((await fetchFeed(data!.url)).status).toBe(404);
    expect((await fetchFeed(second!.url)).status).toBe(200);
    await db().delete(schema.entitlements).where(eq(schema.entitlements.userId, userId));
    expect((await fetchFeed(second!.url)).status).toBe(404);
    await db().insert(schema.entitlements).values({ userId, plan: "pro", source: "comp", periodStart: new Date() });
    await feed.revokeCalendarFeed({});
    expect((await fetchFeed(second!.url)).status).toBe(404);
    expect((await fetchFeed("http://localhost:3000/api/calendar/not-a-token")).status).toBe(404);
  });
});

describe("household list (Pro)", () => {
  it("is Pro only, and answers the same whether or not the email has an account", async () => {
    await signedIn("free@example.com");
    expect(await household.inviteToHousehold({ email: "x@example.com" })).toEqual({ serverError: "plan_required" });
    await signedIn("owner@example.com", "pro");
    expect((await household.inviteToHousehold({ email: "nobody@example.com" })).data).toEqual({ sent: true });
  });

  it("an accepted member shops from the owner's list, until they leave or the owner loses Pro", async () => {
    await signedIn("karim@example.com");
    const ownerId = await signedIn("amina@example.com", "pro");
    await shopping.addShoppingItem({ name: "Bread" });
    expect((await household.inviteToHousehold({ email: "KARIM@example.com" })).data).toEqual({ sent: true });

    await logIn("karim@example.com");
    let list = (await getShoppingList("en"))!;
    expect(list.household.invites).toEqual([{ listId: expect.any(String), fromName: "Amina Benali" }]);
    expect(list.household.invites[0]).not.toHaveProperty("email");
    await household.respondToHouseholdInvite({ listId: list.household.invites[0]!.listId, accept: true });
    list = (await getShoppingList("en"))!;
    // Every test signup is called "Amina Benali" (support/flows.ts).
    expect(list.household.sharedBy).toBe("Amina Benali");
    expect(await names()).toEqual(["Bread"]);
    await shopping.addShoppingItem({ name: "Milk" });

    await logIn("amina@example.com");
    expect((await names()).sort()).toEqual(["Bread", "Milk"]);
    expect((await getShoppingList("en"))!.household.members).toEqual([
      { userId: expect.any(String), name: "Amina Benali", status: "active" },
    ]);

    // The owner drops to Free: Karim is back on his own (empty) list.
    await db().delete(schema.entitlements).where(eq(schema.entitlements.userId, ownerId));
    await logIn("karim@example.com");
    expect(await names()).toEqual([]);

    await db()
      .insert(schema.entitlements)
      .values({ userId: ownerId, plan: "pro", source: "comp", periodStart: new Date() });
    expect(await names()).toEqual(["Bread", "Milk"]);
    await household.leaveHousehold({});
    expect(await names()).toEqual([]);
  });

  it("a member can't touch the owner's list after being removed", async () => {
    await signedIn("karim@example.com");
    await signedIn("amina@example.com", "pro");
    await household.inviteToHousehold({ email: "karim@example.com" });
    await logIn("karim@example.com");
    const { listId } = (await getShoppingList("en"))!.household.invites[0]!;
    await household.respondToHouseholdInvite({ listId, accept: true });

    await logIn("amina@example.com");
    await shopping.addShoppingItem({ name: "Eggs" });
    const [eggs] = (await getShoppingList("en"))!.items;
    const karimId = (await userByEmail("karim@example.com"))!.id;
    expect((await household.removeHouseholdMember({ userId: karimId })).data).toEqual({ removed: true });

    await logIn("karim@example.com");
    expect(await shopping.toggleShoppingItem({ id: eggs!.id, checked: true, at: new Date().toISOString() })).toEqual({
      serverError: "not_found",
    });
  });
});
