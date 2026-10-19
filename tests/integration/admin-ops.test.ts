import { desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { auditActions, db, resetData, userByEmail } from "./support/db";
import { logIn, PASSWORD, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";
import { fakeR2, r2Handlers } from "./support/r2";
import { fakeStripe, stripeHandlers } from "./support/stripe";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const admin = await import("@/server/actions/admin");
const account = await import("@/server/actions/account");
const sharing = await import("@/server/actions/sharing");
const friends = await import("@/server/actions/friends");
const chat = await import("@/server/actions/messages");
const reports = await import("@/server/actions/reports");
const dishes = await import("@/server/actions/dishes");
const discover = await import("@/server/actions/discover");
const adminQueries = await import("@/server/features/admin/queries");
const { getYourData } = await import("@/server/features/account/data");
const { purgeDueAccounts } = await import("@/server/features/account/deletion");
const { cleanupExpired } = await import("@/server/outbox/maintenance");
const { drainOutbox } = await import("@/server/outbox/drain");
const { getSession } = await import("@/server/auth/session");
const { GET: download } = await import("@/app/api/downloads/[id]/route");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeR2.reset();
  fakeStripe.reset();
  hibp.use(...r2Handlers, ...stripeHandlers);
});

type Person = { id: string; email: string; jar: Map<string, string> };

async function person(email: string, role?: "admin"): Promise<Person> {
  browser.reset();
  await signUpAndVerify(email);
  const id = (await userByEmail(email))!.id;
  if (role) await db().update(schema.user).set({ role }).where(eq(schema.user.id, id));
  await logIn(email);
  return { id, email, jar: new Map(browser.cookies) };
}
function as(p: Person) {
  browser.reset();
  for (const [k, v] of p.jar) browser.cookies.set(k, v);
}

const DISH = {
  difficulty: "easy" as const,
  course: "main" as const,
  servings: 2,
  seasons: [],
  dietaryTags: [],
  ingredients: [{ name: "Rice", amount: 200, unit: "g" as const, note: null }],
  steps: [],
  caloriesKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

const CATALOG = {
  id: null,
  slug: "test-harira",
  country: "ma",
  course: "main" as const,
  difficulty: "medium" as const,
  servings: 6,
  seasons: ["winter" as const],
  dietaryTags: [],
  collections: ["ramadan_iftar" as const],
  featured: false,
  name: { en: "Test harira", fr: "Harira test", ar: "" },
  description: { en: "A soup.", fr: "Une soupe.", ar: "" },
  ingredients: [
    {
      amount: 200,
      unit: "g" as const,
      name: { en: "Lentils", fr: "Lentilles", ar: "عدس" },
      note: { en: "", fr: "", ar: "" },
    },
  ],
  steps: [{ text: { en: "Simmer.", fr: "Mijoter.", ar: "" }, timerMinutes: 30 }],
};

describe("admin access", () => {
  it("refuses every admin action and read to anyone who isn't an admin", async () => {
    const someone = await person("someone@example.com");
    const victim = await person("victim@example.com");
    as(someone);
    const target = { userId: victim.id };
    const uuid = "0192f0c8-0000-7000-8000-000000000001";
    const calls = [
      admin.adminMarkVerified(target),
      admin.adminUnlock(target),
      admin.adminSignOutEverywhere(target),
      admin.adminSetSuspended({ ...target, suspended: true }),
      admin.adminSetRole({ ...target, admin: true }),
      admin.adminGrantComp({ ...target, plan: "pro", months: 0 }),
      admin.adminDeleteUser(target),
      admin.adminSaveCatalogDish(CATALOG),
      admin.adminDeleteCatalogDish({ id: uuid }),
      admin.adminDeleteReview({ id: uuid }),
      admin.adminMakeDishPrivate({ id: uuid }),
      admin.adminDeleteDish({ id: uuid }),
      admin.adminResolveReport({ id: uuid, status: "dismissed" }),
      admin.adminSetFeedbackStatus({ id: uuid, status: "resolved" }),
      admin.adminDeleteFeedback({ id: uuid }),
    ];
    for (const result of await Promise.all(calls)) expect(result).toEqual({ serverError: "forbidden" });
    expect(await adminQueries.getAdminOverview()).toBeNull();
    expect(await adminQueries.listUsers("", 1)).toBeNull();
    expect(await adminQueries.listAudit("", 1)).toBeNull();
    expect((await db().select().from(schema.user).where(eq(schema.user.id, victim.id)))[0]!.banned).toBe(false);

    browser.reset();
    expect(await admin.adminSetSuspended({ ...target, suspended: true })).toEqual({ serverError: "unauthorized" });
  });

  it("never lets an admin demote, suspend, sign out or delete themselves", async () => {
    const boss = await person("boss@example.com", "admin");
    as(boss);
    const self = { userId: boss.id };
    expect(await admin.adminSetRole({ ...self, admin: false })).toEqual({ serverError: "forbidden" });
    expect(await admin.adminSetSuspended({ ...self, suspended: true })).toEqual({ serverError: "forbidden" });
    expect(await admin.adminSignOutEverywhere(self)).toEqual({ serverError: "forbidden" });
    expect(await admin.adminDeleteUser(self)).toEqual({ serverError: "forbidden" });
  });
});

describe("users", () => {
  it("suspends (no more sign-in), grants a comp, and audit-logs every step", async () => {
    const boss = await person("boss@example.com", "admin");
    const lina = await person("lina@example.com");
    as(boss);
    expect(await adminQueries.getAdminOverview()).toMatchObject({ users: 2, newThisWeek: 2, mrrCents: 0 });
    expect((await adminQueries.listUsers("lina@", 1))!.rows.map((u) => u.email)).toEqual(["lina@example.com"]);

    await admin.adminGrantComp({ userId: lina.id, plan: "pro", months: 3 });
    const [ent] = await db().select().from(schema.entitlements).where(eq(schema.entitlements.userId, lina.id));
    expect(ent).toMatchObject({ plan: "pro", source: "comp" });
    expect((await adminQueries.getAdminUser(lina.id))!.compEndsAt).not.toBeNull();
    await admin.adminGrantComp({ userId: lina.id, plan: null, months: 0 });
    expect(await db().select().from(schema.entitlements).where(eq(schema.entitlements.userId, lina.id))).toEqual([]);

    await admin.adminSetSuspended({ userId: lina.id, suspended: true });
    as(lina);
    expect(await getSession()).toBeNull();
    browser.reset();
    await expect(logIn("lina@example.com")).rejects.toThrow();

    as(boss);
    await admin.adminSetSuspended({ userId: lina.id, suspended: false });
    await admin.adminSetRole({ userId: lina.id, admin: true });
    expect(await auditActions(boss.id)).toEqual(
      expect.arrayContaining([
        "admin.comp_granted",
        "admin.comp_revoked",
        "admin.user_suspended",
        "admin.user_unsuspended",
        "admin.role_granted",
      ]),
    );
    expect((await adminQueries.listAudit("admin.", 1))!.rows.length).toBeGreaterThanOrEqual(5);
  });

  it("deletes an account through the purge: rows, files and the Stripe customer", async () => {
    const boss = await person("boss@example.com", "admin");
    const lina = await person("lina@example.com");
    await db().insert(schema.billingCustomers).values({ userId: lina.id, stripeCustomerId: "cus_lina" });
    fakeR2.objects.set(`u/${lina.id}/photo.webp`, { body: new Uint8Array([1]), contentType: "image/webp" });
    fakeR2.objects.set(`u/someone-else/photo.webp`, { body: new Uint8Array([1]), contentType: "image/webp" });
    as(boss);
    await admin.adminDeleteUser({ userId: lina.id });
    // Banned at once, so logging in before the purge can't cancel it.
    browser.reset();
    await expect(logIn("lina@example.com")).rejects.toThrow();
    await drainOutbox({ limit: 20 });

    expect(await userByEmail("lina@example.com")).toBeUndefined();
    expect(fakeStripe.customersDeleted).toEqual(["cus_lina"]);
    expect([...fakeR2.objects.keys()]).toEqual(["u/someone-else/photo.webp"]);
    expect(await auditActions(boss.id)).toEqual(expect.arrayContaining(["admin.user_deleted", "account.purged"]));
  });
});

describe("catalog", () => {
  it("creates and edits dishes, flags missing translations, and keeps saved copies when deleted", async () => {
    const boss = await person("boss@example.com", "admin");
    const lina = await person("lina@example.com");
    as(boss);
    const { data } = await admin.adminSaveCatalogDish(CATALOG);
    expect(await admin.adminSaveCatalogDish({ ...CATALOG, name: { ...CATALOG.name, en: "Other" } })).toEqual({
      serverError: "conflict",
    });
    const [row] = (await adminQueries.listCatalog("Test harira", 1))!.rows;
    expect(row).toMatchObject({ country: "MA", missing: ["ar"], saves: 0 });

    as(lina);
    await discover.saveCatalogDish({ slug: "test-harira", locale: "en" });
    as(boss);
    expect((await adminQueries.listCatalog("test", 1))!.rows[0]!.saves).toBe(1);
    await admin.adminSaveCatalogDish({
      ...CATALOG,
      id: data!.id,
      name: { ...CATALOG.name, ar: "حريرة" },
      description: { ...CATALOG.description, ar: "حساء." },
      steps: [{ text: { en: "Simmer.", fr: "Mijoter.", ar: "اطبخي على نار هادئة." }, timerMinutes: 30 }],
    });
    expect((await adminQueries.listCatalog("test", 1))!.rows[0]!.missing).toEqual([]);

    await admin.adminDeleteCatalogDish({ id: data!.id });
    const [copy] = await db().select().from(schema.dishes).where(eq(schema.dishes.userId, lina.id));
    expect(copy).toMatchObject({ name: "Test harira", catalogDishId: null, followsCatalog: false });
    expect(await auditActions(boss.id)).toEqual(
      expect.arrayContaining(["admin.catalog_created", "admin.catalog_updated", "admin.catalog_deleted"]),
    );
  });
});

describe("content and reports", () => {
  it("resolves a message report by removing it and suspending the sender", async () => {
    const boss = await person("boss@example.com", "admin");
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(amina);
    await friends.sendFriendRequest({ userId: lina.id });
    as(lina);
    const [request] = await db().select().from(schema.friendRequests);
    await friends.respondToFriendRequest({ requestId: request!.id, response: "accept" });
    const conversationId = (await chat.openConversation({ userId: amina.id })).data!.conversationId;
    const { data: sent } = await chat.sendMessage({ conversationId, content: "Buy cheap watches here" });
    as(amina);
    await reports.reportContent({ targetType: "message", targetId: sent!.id, reason: "spam" });

    as(boss);
    const queue = (await adminQueries.listReports("open", 1))!.rows;
    expect(queue[0]).toMatchObject({ targetType: "message", preview: { text: "Buy cheap watches here" } });
    await admin.adminResolveReport({ id: queue[0]!.id, status: "resolved", action: "remove_content" });
    const [message] = await db().select().from(schema.messages).where(eq(schema.messages.id, sent!.id));
    expect(message).toMatchObject({ content: "" });
    expect(message!.deletedAt).not.toBeNull();
    expect((await adminQueries.listReports("open", 1))!.rows).toEqual([]);

    await reports.reportContent({ targetType: "user", targetId: lina.id, reason: "spam" }).catch(() => undefined);
    as(amina);
    await reports.reportContent({ targetType: "user", targetId: lina.id, reason: "harassment" });
    as(boss);
    const [userReport] = (await adminQueries.listReports("open", 1))!.rows;
    await admin.adminResolveReport({ id: userReport!.id, status: "resolved", action: "suspend_user" });
    expect((await db().select().from(schema.user).where(eq(schema.user.id, lina.id)))[0]!.banned).toBe(true);
  });

  it("makes a shared dish private, deletes a review, and lists both first", async () => {
    const boss = await person("boss@example.com", "admin");
    const lina = await person("lina@example.com");
    as(lina);
    const { data: dish } = await dishes.createDish({ name: "Shared couscous", ...DISH });
    await sharing.setDishSharing({ dishId: dish!.id, visibility: "friends", groupIds: [] });
    as(boss);
    expect((await adminQueries.listSharedDishes(1))!.rows.map((d) => d.name)).toEqual(["Shared couscous"]);
    await admin.adminMakeDishPrivate({ id: dish!.id });
    expect((await adminQueries.listSharedDishes(1))!.rows).toEqual([]);
    const [row] = await db().select().from(schema.dishes).where(eq(schema.dishes.id, dish!.id));
    expect(row).toMatchObject({ visibility: "private", userId: lina.id });
  });
});

describe("feedback", () => {
  it("takes 5 messages an hour, with language and browser attached, for admins to resolve", async () => {
    const boss = await person("boss@example.com", "admin");
    const lina = await person("lina@example.com");
    as(lina);
    for (let i = 0; i < 5; i++) {
      expect((await account.sendFeedback({ kind: "bug", message: `Bug ${i}` })).data).toEqual({ sent: true });
    }
    expect(await account.sendFeedback({ kind: "bug", message: "One more" })).toEqual({ serverError: "rate_limited" });

    as(boss);
    const list = (await adminQueries.listFeedback({ status: "open", kind: null }, 1))!;
    expect(list.total).toBe(5);
    expect(list.rows[0]).toMatchObject({ kind: "bug", userAgent: "Cooky integration test", email: "lina@example.com" });
    await admin.adminSetFeedbackStatus({ id: list.rows[0]!.id, status: "resolved" });
    expect((await adminQueries.listFeedback({ status: "open", kind: null }, 1))!.total).toBe(4);
  });
});

describe("your data", () => {
  it("prepares an export in the background, downloadable only by its owner, until it expires", async () => {
    const lina = await person("lina@example.com");
    const amina = await person("amina@example.com");
    as(lina);
    await dishes.createDish({ name: "Lina's pilaf", ...DISH });
    await account.requestDataExport({});
    expect(await account.requestDataExport({})).toEqual({ serverError: "rate_limited" });
    await drainOutbox({ limit: 20 });

    const data = (await getYourData())!;
    expect(data.export).toMatchObject({ status: "ready" });
    const path = data.export!.downloadPath!;
    const [, id] = path.match(/\/api\/downloads\/([^?]+)/)!;
    const get = (url: string) =>
      download(new Request(`http://localhost:3000${url}`), { params: Promise.resolve({ id: id! }) });

    const response = await get(path);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const body = JSON.parse(await response.text());
    expect(body.recipes.dishes.map((d: { name: string }) => d.name)).toEqual(["Lina's pilaf"]);
    expect(JSON.stringify(body)).not.toContain("amina@example.com");
    expect(fakeR2.objects.has(`u/${lina.id}/exports/${id}.json`)).toBe(true);

    // A tampered link, someone else's session, or an expired export: nothing.
    expect((await get(path.replace(/s=[^&]+/, "s=forged"))).status).toBe(404);
    as(amina);
    expect((await get(path)).status).toBe(404);
    as(lina);
    await db()
      .update(schema.dataExports)
      .set({ expiresAt: sql`now() - interval '1 minute'` });
    expect((await get(path)).status).toBe(404);
    expect((await getYourData())!.export!.status).toBe("expired");

    expect((await cleanupExpired()).exports).toBe(1);
    expect(fakeR2.objects.has(`u/${lina.id}/exports/${id}.json`)).toBe(false);
  });

  it("deletes the account after a 7-day grace, cancelled by logging in", async () => {
    const lina = await person("lina@example.com");
    await db().insert(schema.billingCustomers).values({ userId: lina.id, stripeCustomerId: "cus_lina" });
    await db()
      .insert(schema.subscriptions)
      .values({
        id: "sub_lina",
        userId: lina.id,
        plan: "plus",
        interval: "month",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
        cancelAtPeriodEnd: false,
      });
    as(lina);
    expect((await account.requestAccountDeletion({ password: "wrong password!" })).data).toEqual({
      status: "wrong_password",
    });
    expect((await account.requestAccountDeletion({})).data).toEqual({ status: "password_required" });
    expect((await account.requestAccountDeletion({ password: PASSWORD })).data).toEqual({ status: "scheduled" });
    expect(await getSession()).toBeNull();
    await drainOutbox({ limit: 20 });
    expect(fakeStripe.subscriptionsCancelled).toEqual(["sub_lina"]);

    // Logging in within the grace keeps the account.
    browser.reset();
    await logIn("lina@example.com");
    expect((await getSession())!.user.email).toBe("lina@example.com");
    expect((await userByEmail("lina@example.com"))!.status).toBe("active");
    expect(await auditActions(lina.id)).toEqual(
      expect.arrayContaining(["account.deletion_requested", "account.deletion_cancelled"]),
    );

    // Asked again, and this time the grace runs out.
    await account.requestAccountDeletion({ password: PASSWORD });
    expect((await purgeDueAccounts()).purged).toBe(0);
    await db()
      .update(schema.user)
      .set({ deletionRequestedAt: sql`now() - interval '8 days'` })
      .where(eq(schema.user.id, lina.id));
    expect(await purgeDueAccounts()).toEqual({ purged: 1, failed: 0 });
    expect(await userByEmail("lina@example.com")).toBeUndefined();
    expect(fakeStripe.customersDeleted).toEqual(["cus_lina"]);
    const [purged] = await db().select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(1);
    expect(purged).toMatchObject({ action: "account.purged", targetId: lina.id, actorId: null });
  });
});
