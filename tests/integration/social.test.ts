import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

// Realtime and push are "configured" here, so their outbox jobs are queued and
// can be drained into the mocked SDKs below: that's how we prove what leaves.
vi.hoisted(() => {
  process.env.PUSHER_APP_ID = "123456";
  process.env.PUSHER_SECRET = "pusher-secret";
  process.env.NEXT_PUBLIC_PUSHER_KEY = "pusher-key";
  process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "vapid-public";
  process.env.VAPID_PRIVATE_KEY = "vapid-private";
  process.env.VAPID_SUBJECT = "mailto:test@cooky.example";
});
const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));
const trigger = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({})));
vi.mock("pusher", () => ({
  default: class {
    trigger = trigger;
    authorizeChannel = (socketId: string, channel: string) => ({ auth: `pusher-key:${socketId}:${channel}` });
  },
}));
const sendNotification = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({})));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
  WebPushError: class extends Error {
    statusCode = 0;
  },
}));

const schema = await import("@/server/db/schema");
const friends = await import("@/server/actions/friends");
const sharing = await import("@/server/actions/sharing");
const chat = await import("@/server/actions/messages");
const reports = await import("@/server/actions/reports");
const notifications = await import("@/server/actions/notifications");
const dishes = await import("@/server/actions/dishes");
const cook = await import("@/server/actions/cook");
const security = await import("@/server/actions/security");
const socialQueries = await import("@/server/features/social/queries");
const messageQueries = await import("@/server/features/messages/queries");
const dishQueries = await import("@/server/features/dishes/queries");
const { drainOutbox } = await import("@/server/outbox/drain");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  trigger.mockClear();
  sendNotification.mockClear();
});

type Person = { id: string; email: string; jar: Map<string, string> };

/** A confirmed, signed-in account; its cookies are kept so tests can switch between people. */
async function person(email: string, displayName?: string): Promise<Person> {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  const id = (await userByEmail(email))!.id;
  if (displayName) await db().update(schema.profiles).set({ displayName }).where(eq(schema.profiles.userId, id));
  return { id, email, jar: new Map(browser.cookies) };
}

/** Act as this person from now on. */
function as(p: Person) {
  browser.reset();
  for (const [k, v] of p.jar) browser.cookies.set(k, v);
}

async function befriend(a: Person, b: Person) {
  as(a);
  await friends.sendFriendRequest({ userId: b.id });
  as(b);
  const page = await socialQueries.getFriendsPage();
  await friends.respondToFriendRequest({ requestId: page!.incoming[0]!.id, response: "accept" });
}

async function newDish(name: string) {
  const { data } = await dishes.createDish({
    name,
    difficulty: "easy",
    course: "main",
    servings: 4,
    seasons: [],
    dietaryTags: [],
    ingredients: [{ name: "Chicken", amount: 500, unit: "g", note: null }],
    steps: [{ text: "Cook it.", timerMinutes: null, prepDayBefore: false }],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  return data!.id;
}

const outboxKinds = async () =>
  (await db().select({ kind: schema.outbox.kind }).from(schema.outbox)).map((r) => r.kind);

describe("who may call social actions", () => {
  it("refuses signed-out callers everywhere", async () => {
    const someone = "user_123";
    expect(await friends.sendFriendRequest({ userId: someone })).toEqual({ serverError: "unauthorized" });
    expect(await friends.searchPeople({ query: "Lina" })).toEqual({ serverError: "unauthorized" });
    expect(await chat.openConversation({ userId: someone })).toEqual({ serverError: "unauthorized" });
    expect(await reports.reportContent({ targetType: "user", targetId: someone, reason: "spam" })).toEqual({
      serverError: "unauthorized",
    });
    expect(await socialQueries.getFriendsPage()).toBeNull();
  });

  it("treats a suspended account as signed out", async () => {
    const lina = await person("lina@example.com");
    const amina = await person("amina@example.com");
    await db().update(schema.user).set({ banned: true }).where(eq(schema.user.id, amina.id));
    as(amina);
    expect(await friends.sendFriendRequest({ userId: lina.id })).toEqual({ serverError: "unauthorized" });
  });
});

describe("friend requests", () => {
  it("sends, then accepting makes friends and tells the sender", async () => {
    const amina = await person("amina@example.com", "Amina");
    const lina = await person("lina@example.com", "Lina");
    as(amina);
    expect((await friends.sendFriendRequest({ userId: lina.id })).data).toEqual({ relation: "outgoing" });

    as(lina);
    const page = await socialQueries.getFriendsPage();
    expect(page!.incoming.map((r) => r.person.displayName)).toEqual(["Amina"]);
    expect((await socialQueries.getSocialBadges())!.newRequests).toBe(1);
    await friends.markFriendsSeen({});
    expect((await socialQueries.getSocialBadges())!.newRequests).toBe(0);

    await friends.respondToFriendRequest({ requestId: page!.incoming[0]!.id, response: "accept" });
    expect((await socialQueries.getFriendsPage())!.friends.map((f) => f.displayName)).toEqual(["Amina"]);
    as(amina);
    expect((await socialQueries.getFriendsPage())!.friends.map((f) => f.relation)).toEqual(["friend"]);
  });

  it("accepts their request instead of crossing it with a new one", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(lina);
    await friends.sendFriendRequest({ userId: amina.id });
    as(amina);
    expect((await friends.sendFriendRequest({ userId: lina.id })).data).toEqual({ relation: "friend" });
    expect(await db().select().from(schema.friendRequests)).toHaveLength(0);
  });

  it("keeps a decline silent: still 'Requested', nothing re-sent, and again possible after 30 days", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(amina);
    await friends.sendFriendRequest({ userId: lina.id });
    as(lina);
    const [request] = (await socialQueries.getFriendsPage())!.incoming;
    await friends.respondToFriendRequest({ requestId: request!.id, response: "decline" });

    as(amina);
    expect((await socialQueries.getFriendsPage())!.outgoing).toHaveLength(1);
    await db().delete(schema.outbox);
    expect((await friends.sendFriendRequest({ userId: lina.id })).data).toEqual({ relation: "outgoing" });
    expect(await outboxKinds()).toEqual([]);

    // Withdrawing during the cooldown hides it, and asking again still sends nothing.
    expect((await friends.cancelFriendRequest({ userId: lina.id })).data).toEqual({ relation: "none" });
    expect((await socialQueries.getFriendsPage())!.outgoing).toHaveLength(0);
    expect((await friends.sendFriendRequest({ userId: lina.id })).data).toEqual({ relation: "outgoing" });
    expect(await outboxKinds()).toEqual([]);
    as(lina);
    expect((await socialQueries.getFriendsPage())!.incoming).toHaveLength(0);

    await db()
      .update(schema.friendRequests)
      .set({ sentAt: sql`now() - interval '31 days'` });
    as(amina);
    await friends.sendFriendRequest({ userId: lina.id });
    as(lina);
    expect((await socialQueries.getFriendsPage())!.incoming).toHaveLength(1);
  });

  it("allows 20 requests an hour", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    const others = Array.from({ length: 20 }, (_, i) => ({
      id: `filler_${i}`,
      name: `Filler ${i}`,
      email: `filler${i}@example.com`,
      emailVerified: true,
    }));
    await db().insert(schema.user).values(others);
    await db()
      .insert(schema.friendRequests)
      .values(others.map((o) => ({ fromUserId: amina.id, toUserId: o.id })));
    as(amina);
    expect(await friends.sendFriendRequest({ userId: lina.id })).toEqual({ serverError: "rate_limited" });
    await db()
      .update(schema.friendRequests)
      .set({ sentAt: sql`now() - interval '2 hours'` });
    expect((await friends.sendFriendRequest({ userId: lina.id })).data).toEqual({ relation: "outgoing" });
  });

  it("only answers requests addressed to you", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    const karim = await person("karim@example.com");
    as(amina);
    await friends.sendFriendRequest({ userId: lina.id });
    const [row] = await db().select().from(schema.friendRequests);
    as(karim);
    expect(await friends.respondToFriendRequest({ requestId: row!.id, response: "accept" })).toEqual({
      serverError: "not_found",
    });
  });
});

describe("people search", () => {
  it("finds by name or exact email, and never shows an email", async () => {
    const amina = await person("amina@example.com", "Amina");
    await person("lina@example.com", "Lina Haddad");
    as(amina);
    const byName = (await friends.searchPeople({ query: "haddad" })).data!.people;
    expect(byName.map((p) => p.displayName)).toEqual(["Lina Haddad"]);
    expect(JSON.stringify(byName)).not.toContain("@");
    expect((await friends.searchPeople({ query: "lina@example" })).data!.people).toEqual([]);
    expect((await friends.searchPeople({ query: "LINA@example.com" })).data!.people).toHaveLength(1);
    expect(await friends.searchPeople({ query: "a" })).toMatchObject({ validationErrors: expect.anything() });
  });

  it("treats % and _ as letters", async () => {
    const amina = await person("amina@example.com");
    await person("lina@example.com", "Lina");
    as(amina);
    expect((await friends.searchPeople({ query: "%%" })).data!.people).toEqual([]);
  });
});

describe("blocking", () => {
  it("keeps the blocked person from finding, adding, seeing or messaging, without telling them", async () => {
    const amina = await person("amina@example.com", "Amina");
    const lina = await person("lina@example.com", "Lina");
    await befriend(amina, lina);
    as(lina);
    const dishId = await newDish("Baklava");
    await sharing.setDishSharing({ dishId, visibility: "friends", groupIds: [] });
    as(amina);
    const { data: convo } = await chat.openConversation({ userId: lina.id });

    as(lina);
    await db().delete(schema.outbox);
    await friends.blockUser({ userId: amina.id });
    expect(await outboxKinds()).toEqual([]);
    expect((await socialQueries.getBlockedPeople())!.map((b) => b.displayName)).toEqual(["Amina"]);

    as(amina);
    expect((await friends.searchPeople({ query: "Lina" })).data!.people).toEqual([]);
    expect((await friends.searchPeople({ query: "lina@example.com" })).data!.people).toEqual([]);
    expect(await friends.sendFriendRequest({ userId: lina.id })).toEqual({ serverError: "not_found" });
    expect(await socialQueries.getFriendProfile(lina.id, 1)).toBeNull();
    expect(await dishQueries.getFriendDish(dishId)).toBeNull();
    expect(await chat.sendMessage({ conversationId: convo!.conversationId, content: "Hi" })).toEqual({
      serverError: "forbidden",
    });
    expect((await socialQueries.getFriendsPage())!.friends).toEqual([]);

    // Unblocking doesn't bring the friendship back.
    as(lina);
    await friends.unblockUser({ userId: amina.id });
    expect((await socialQueries.getFriendsPage())!.friends).toEqual([]);
    as(amina);
    expect((await friends.searchPeople({ query: "Lina" })).data!.people).toHaveLength(1);
  });

  it("can block straight from a request", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(amina);
    await friends.sendFriendRequest({ userId: lina.id });
    as(lina);
    const [request] = (await socialQueries.getFriendsPage())!.incoming;
    await friends.respondToFriendRequest({ requestId: request!.id, response: "block" });
    expect(await db().select().from(schema.friendRequests)).toHaveLength(0);
    as(amina);
    expect(await friends.sendFriendRequest({ userId: lina.id })).toEqual({ serverError: "not_found" });
  });
});

describe("dish sharing and groups", () => {
  it("shows a dish only to the people its owner chose", async () => {
    const lina = await person("lina@example.com");
    const amina = await person("amina@example.com");
    const karim = await person("karim@example.com");
    const stranger = await person("stranger@example.com");
    await befriend(lina, amina);
    await befriend(lina, karim);
    as(lina);
    const dishId = await newDish("Baklava");

    as(amina);
    expect(await dishQueries.getFriendDish(dishId)).toBeNull(); // private by default

    as(lina);
    await sharing.setDishSharing({ dishId, visibility: "friends", groupIds: [] });
    as(amina);
    expect((await dishQueries.getFriendDish(dishId))!.owner.relation).toBe("friend");
    as(stranger);
    expect(await dishQueries.getFriendDish(dishId)).toBeNull();

    as(lina);
    const { data: group } = await sharing.createFriendGroup({ name: "Family", memberIds: [amina.id] });
    expect(await sharing.setDishSharing({ dishId, visibility: "groups", groupIds: [] })).toEqual({
      serverError: "invalid",
    });
    await sharing.setDishSharing({ dishId, visibility: "groups", groupIds: [group!.id] });
    as(amina);
    expect(await dishQueries.getFriendDish(dishId)).not.toBeNull();
    as(karim);
    expect(await dishQueries.getFriendDish(dishId)).toBeNull();

    // Unfriending ends group membership at once.
    as(lina);
    await friends.unfriend({ userId: amina.id });
    as(amina);
    expect(await dishQueries.getFriendDish(dishId)).toBeNull();
  });

  it("refuses someone else's dish or groups, non-friend members, and groups past the plan's cap", async () => {
    const lina = await person("lina@example.com");
    const amina = await person("amina@example.com");
    as(lina);
    const dishId = await newDish("Baklava");
    const { data: family } = await sharing.createFriendGroup({ name: "Family", memberIds: [] });
    expect(await sharing.createFriendGroup({ name: "family", memberIds: [] })).toEqual({ serverError: "conflict" });
    expect(await sharing.createFriendGroup({ name: "Work", memberIds: [amina.id] })).toEqual({
      serverError: "invalid",
    });
    await sharing.createFriendGroup({ name: "Work", memberIds: [] });
    expect(await sharing.createFriendGroup({ name: "Neighbours", memberIds: [] })).toEqual({
      serverError: "quota_exceeded",
    });

    as(amina);
    expect(await sharing.setDishSharing({ dishId, visibility: "friends", groupIds: [] })).toEqual({
      serverError: "not_found",
    });
    const mine = await newDish("Harira");
    expect(await sharing.setDishSharing({ dishId: mine, visibility: "groups", groupIds: [family!.id] })).toEqual({
      serverError: "not_found",
    });
    expect(await sharing.deleteFriendGroup({ id: family!.id })).toEqual({ serverError: "not_found" });
  });

  it("copies a friend's dish privately, and rating the copy rates the original", async () => {
    const lina = await person("lina@example.com", "Lina");
    const amina = await person("amina@example.com", "Amina");
    await befriend(lina, amina);
    as(lina);
    const original = await newDish("Baklava");

    as(amina);
    expect(await sharing.copyFriendDish({ dishId: original, locale: "en" })).toEqual({ serverError: "not_found" });
    as(lina);
    await sharing.setDishSharing({ dishId: original, visibility: "friends", groupIds: [] });
    expect(await sharing.copyFriendDish({ dishId: original, locale: "en" })).toEqual({ serverError: "invalid" });

    as(amina);
    const { data: copy } = await sharing.copyFriendDish({ dishId: original, locale: "en" });
    const [row] = await db().select().from(schema.dishes).where(eq(schema.dishes.id, copy!.id));
    expect(row).toMatchObject({ userId: amina.id, copiedFromDishId: original, visibility: "private" });
    expect((await dishQueries.getFriendDish(original))!.myCopyId).toBe(copy!.id);

    await cook.logCook({ dishId: copy!.id });
    await cook.rateDish({ dishId: copy!.id, stars: 5, review: "Perfect" });

    as(lina);
    const dish = await dishQueries.getDish(original);
    expect(dish!.reviews).toMatchObject({ count: 1, average: 5 });
    expect(dish!.reviews.items[0]).toMatchObject({ stars: 5, review: "Perfect", person: { displayName: "Amina" } });
  });
});

describe("messages", () => {
  it("only lets friends start a chat", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(amina);
    expect(await chat.openConversation({ userId: lina.id })).toEqual({ serverError: "forbidden" });
    await befriend(amina, lina);
    as(amina);
    const first = await chat.openConversation({ userId: lina.id });
    const again = await chat.openConversation({ userId: lina.id });
    expect(first.data!.conversationId).toBe(again.data!.conversationId);
  });

  it("delivers, reads and shows receipts; unread dot follows", async () => {
    const amina = await person("amina@example.com", "Amina");
    const lina = await person("lina@example.com", "Lina");
    await befriend(amina, lina);
    as(amina);
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    await chat.sendMessage({ conversationId, content: "  Salam! Dinner Friday?  " });
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]).toMatchObject({
      text: "Salam! Dinner Friday?",
      status: "sent",
    });

    as(lina);
    expect((await socialQueries.getSocialBadges())!.unreadMessages).toBe(true);
    const inbox = await messageQueries.getConversations(false);
    expect(inbox!.conversations[0]).toMatchObject({ unread: true, person: { displayName: "Amina" } });
    await chat.markMessagesDelivered({});
    as(amina);
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]!.status).toBe("delivered");

    as(lina);
    await chat.markConversationRead({ conversationId });
    expect((await socialQueries.getSocialBadges())!.unreadMessages).toBe(false);
    as(amina);
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]!.status).toBe("seen");
  });

  it("edits and deletes only your own messages, with Undo", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    await befriend(amina, lina);
    as(amina);
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    const { data: sent } = await chat.sendMessage({ conversationId, content: "Typo" });

    as(lina);
    expect(await chat.editMessage({ messageId: sent!.id, content: "Hacked" })).toEqual({ serverError: "not_found" });
    expect(await chat.deleteMessage({ messageId: sent!.id })).toEqual({ serverError: "not_found" });

    as(amina);
    await chat.editMessage({ messageId: sent!.id, content: "Fixed" });
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]).toMatchObject({
      text: "Fixed",
      edited: true,
    });
    await chat.deleteMessage({ messageId: sent!.id });
    as(lina);
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]).toMatchObject({
      text: null,
      deleted: true,
    });
    as(amina);
    await chat.restoreMessage({ messageId: sent!.id });
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]!.text).toBe("Fixed");
  });

  it("wipes a deleted message's text for good after a day", async () => {
    const { purgeDeleted } = await import("@/server/features/dishes/cleanup");
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    await befriend(amina, lina);
    as(amina);
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    const { data: sent } = await chat.sendMessage({ conversationId, content: "Oops, wrong chat" });
    await chat.deleteMessage({ messageId: sent!.id });
    await db()
      .update(schema.messages)
      .set({ deletedAt: sql`now() - interval '2 days'` })
      .where(eq(schema.messages.id, sent!.id));

    expect((await purgeDeleted()).messages).toBe(1);
    const [row] = await db().select().from(schema.messages).where(eq(schema.messages.id, sent!.id));
    expect(row!.content).toBe("");
    expect(await chat.restoreMessage({ messageId: sent!.id })).toEqual({ serverError: "not_found" });
  });

  it("attaches only dishes the friend can open, and hides them once unshared", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    await befriend(amina, lina);
    as(amina);
    const dishId = await newDish("Couscous");
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    expect(await chat.sendMessage({ conversationId, content: "", dishId })).toEqual({ serverError: "invalid" });
    expect((await chat.getAttachableDishes({ conversationId })).data!.dishes).toEqual([]);

    await sharing.setDishSharing({ dishId, visibility: "friends", groupIds: [] });
    expect((await chat.getAttachableDishes({ conversationId })).data!.dishes.map((d) => d.name)).toEqual(["Couscous"]);
    await chat.sendMessage({ conversationId, content: "", dishId });
    as(lina);
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]!.dish).toMatchObject({
      name: "Couscous",
      available: true,
    });
    as(amina);
    await sharing.setDishSharing({ dishId, visibility: "private", groupIds: [] });
    as(lina);
    expect((await messageQueries.getThread(conversationId, 50))!.messages[0]!.dish).toMatchObject({
      name: "",
      available: false,
    });
  });

  it("becomes read-only after an unfriend, and stays private to the two people", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    const karim = await person("karim@example.com");
    await befriend(amina, lina);
    as(amina);
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    await chat.sendMessage({ conversationId, content: "Hi" });

    as(karim);
    expect(await messageQueries.getThread(conversationId, 50)).toBeNull();
    expect(await chat.sendMessage({ conversationId, content: "Me too" })).toEqual({ serverError: "not_found" });
    expect(await chat.markConversationRead({ conversationId })).toEqual({ serverError: "not_found" });

    as(lina);
    await friends.unfriend({ userId: amina.id });
    const thread = await messageQueries.getThread(conversationId, 50);
    expect(thread).toMatchObject({ canSend: false });
    expect(thread!.messages).toHaveLength(1);
    expect(await chat.sendMessage({ conversationId, content: "Bye" })).toEqual({ serverError: "forbidden" });
  });

  it("archives and clears for one side only", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    await befriend(amina, lina);
    as(amina);
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    await chat.sendMessage({ conversationId, content: "One" });

    await chat.setConversationArchived({ conversationId, archived: true });
    expect((await messageQueries.getConversations(false))!.conversations).toHaveLength(0);
    expect((await messageQueries.getConversations(true))!.conversations).toHaveLength(1);
    as(lina);
    expect((await messageQueries.getConversations(false))!.conversations).toHaveLength(1);
    await chat.sendMessage({ conversationId, content: "Two" });
    as(amina);
    // A new message brings it back.
    expect((await messageQueries.getConversations(false))!.conversations).toHaveLength(1);

    await chat.clearConversation({ conversationId });
    expect((await messageQueries.getThread(conversationId, 50))!.messages).toHaveLength(0);
    as(lina);
    expect((await messageQueries.getThread(conversationId, 50))!.messages).toHaveLength(2);
  });

  it("sends Pusher only ids, and push only the sender's name", async () => {
    const amina = await person("amina@example.com", "Amina");
    const lina = await person("lina@example.com", "Lina");
    await befriend(amina, lina);
    await db()
      .insert(schema.pushSubscriptions)
      .values({
        userId: lina.id,
        sessionId: (await db().select().from(schema.session).where(eq(schema.session.userId, lina.id)))[0]!.id,
        endpoint: "https://push.example/lina",
        p256dh: "p",
        auth: "a",
        locale: "fr",
      });
    as(amina);
    const conversationId = (await chat.openConversation({ userId: lina.id })).data!.conversationId;
    await chat.sendMessage({ conversationId, content: "The secret family recipe is cardamom" });
    await chat.sendTyping({ conversationId });
    await drainOutbox({ limit: 50 });

    const pushed = JSON.stringify(trigger.mock.calls);
    expect(pushed).not.toContain("cardamom");
    expect(pushed).not.toContain("@example.com");
    expect(trigger).toHaveBeenCalledWith([`private-user-${lina.id}`], "cooky", { type: "message", conversationId });
    expect(trigger).toHaveBeenCalledWith([`private-user-${lina.id}`], "cooky", { type: "typing", conversationId });
    for (const [, , event] of trigger.mock.calls) {
      expect(Object.keys(event as object).sort()).toEqual(
        (event as { type: string }).type === "friends" ? ["type"] : ["conversationId", "type"],
      );
    }

    const notification = sendNotification.mock.calls.map(([, payload]) => JSON.parse(payload as string));
    expect(notification).toContainEqual(
      expect.objectContaining({ title: "Message de Amina", url: `/messages/${conversationId}` }),
    );
    expect(JSON.stringify(notification)).not.toContain("cardamom");
    // Written in the device's language.
    expect(JSON.stringify(notification)).toContain("Ouvrez Cooky pour le lire.");
  });

  it("respects a switched-off notification type", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(lina);
    await notifications.setNotificationPrefs({ off: ["friend_requests"] });
    await db()
      .insert(schema.pushSubscriptions)
      .values({
        userId: lina.id,
        sessionId: (await db().select().from(schema.session).where(eq(schema.session.userId, lina.id)))[0]!.id,
        endpoint: "https://push.example/lina",
        p256dh: "p",
        auth: "a",
        locale: "en",
      });
    as(amina);
    await friends.sendFriendRequest({ userId: lina.id });
    await drainOutbox({ limit: 50 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("realtime channel and push subscriptions", () => {
  it("signs only the caller's own channel", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    as(amina);
    const own = await notifications.authorizeRealtime({ socketId: "1.2", channelName: `private-user-${amina.id}` });
    expect(own.data!.auth).toContain(`private-user-${amina.id}`);
    expect(await notifications.authorizeRealtime({ socketId: "1.2", channelName: `private-user-${lina.id}` })).toEqual({
      serverError: "forbidden",
    });
  });

  it("ties a push subscription to the device: revoking it removes the subscription", async () => {
    const amina = await person("amina@example.com");
    // A second device for the same person.
    browser.reset();
    await logIn("amina@example.com");
    await notifications.savePushSubscription({
      endpoint: "https://push.example/phone",
      p256dh: "p",
      auth: "a",
      locale: "ar",
    });
    const [sub] = await db().select().from(schema.pushSubscriptions);
    expect(sub).toMatchObject({ userId: amina.id, locale: "ar" });

    as(amina);
    await security.revokeDevice({ sessionId: sub!.sessionId });
    expect(await db().select().from(schema.pushSubscriptions)).toHaveLength(0);
  });
});

describe("reports", () => {
  it("files one open report per target, for what the reporter can see only", async () => {
    const amina = await person("amina@example.com");
    const lina = await person("lina@example.com");
    await befriend(amina, lina);
    as(lina);
    const conversationId = (await chat.openConversation({ userId: amina.id })).data!.conversationId;
    const { data: sent } = await chat.sendMessage({ conversationId, content: "Spam spam" });
    const privateDish = await newDish("Secret");

    as(amina);
    const report = { targetType: "message" as const, targetId: sent!.id, reason: "spam" as const };
    expect((await reports.reportContent(report)).data).toEqual({ reported: true });
    expect((await reports.reportContent(report)).data).toEqual({ reported: true });
    expect(
      await db()
        .select()
        .from(schema.reports)
        .where(and(eq(schema.reports.targetId, sent!.id), eq(schema.reports.status, "open"))),
    ).toHaveLength(1);
    expect(await reports.reportContent({ targetType: "dish", targetId: privateDish, reason: "other" })).toEqual({
      serverError: "not_found",
    });
    expect(await reports.reportContent({ targetType: "user", targetId: amina.id, reason: "other" })).toEqual({
      serverError: "not_found",
    });

    as(lina);
    expect(await reports.reportContent({ ...report })).toEqual({ serverError: "not_found" });
  });
});
