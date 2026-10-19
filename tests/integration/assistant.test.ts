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
const assistant = await import("@/server/actions/assistant");
const dishes = await import("@/server/actions/dishes");
const kitchen = await import("@/server/actions/kitchen");
const { getAssistantPage, pruneAssistantHistory, ASSISTANT_RETENTION_MS } =
  await import("@/server/features/assistant/queries");
const tries = await import("@/server/quota/tries");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeGroq.reset();
  hibp.use(...aiHandlers);
});

async function signedIn(email = "amina@example.com") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

async function addDish(name: string, ingredients: string[]) {
  const { data } = await dishes.createDish({
    name,
    difficulty: "easy",
    course: "main",
    servings: 4,
    seasons: [],
    dietaryTags: [],
    ingredients: ingredients.map((n) => ({ name: n, amount: null, unit: null, note: null })),
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  return data!.id;
}

const ask = (text: string, threadId: string | null = null) => assistant.askAssistant({ threadId, text, locale: "en" });
const systemPrompt = (i = 0) => fakeGroq.chatRequests[i]!.messages.find((m) => m.role === "system")!.content;

describe("askAssistant", () => {
  it("requires a session", async () => {
    expect(await ask("Hi")).toEqual({ serverError: "unauthorized" });
  });

  it("suggests only real dishes: aliases map back, invented ids are dropped", async () => {
    const userId = await signedIn();
    const tagine = await addDish("Chicken tagine", ["Chicken", "Olives", "Lemon"]);
    await kitchen.addPantryItems({ names: ["chicken", "lemon"] });
    fakeGroq.answer = {
      reply: "Your tagine is nearly ready, and harira would warm you up.",
      picks: [
        { id: "m1", why: "Only olives missing" },
        { id: "m42", why: "Not a real candidate" },
        { id: "d1", why: "A new idea" },
      ],
    };
    const { data } = await ask("What can I make with chicken?");
    expect(data?.answer.content).toBe("Your tagine is nearly ready, and harira would warm you up.");
    expect(data?.answer.picks).toHaveLength(2);
    expect(data?.answer.picks[0]).toMatchObject({
      kind: "mine",
      dishId: tagine,
      name: "Chicken tagine",
      missing: ["Olives"],
    });
    expect(data?.answer.picks[1]).toMatchObject({ kind: "discover", saved: false });
    expect((await tries.usageFor(userId, "assistant")).used).toBe(1);

    // The model saw aliases and the person's context, never database ids.
    const prompt = systemPrompt();
    expect(prompt).toMatch(/m1 \| Chicken tagine \| main/);
    expect(prompt).toMatch(/In their kitchen: .*Chicken/);
    expect(prompt).not.toContain(tagine);
    expect(prompt).toContain("Always answer in English");
  });

  it("saves the conversation, and a follow-up carries the earlier turns", async () => {
    await signedIn();
    fakeGroq.answer = { reply: "Try a soup.", picks: [] };
    const first = await ask("Something warm for tonight");
    const threadId = first.data!.threadId;
    fakeGroq.answer = { reply: "A lentil soup then.", picks: [] };
    await ask("Lighter, please", threadId);

    expect(fakeGroq.chatRequests[1]!.messages.filter((m) => m.role !== "system").map((m) => m.content)).toEqual([
      "Something warm for tonight",
      "Try a soup.",
      "Lighter, please",
    ]);
    const page = await getAssistantPage(threadId, "en");
    expect(page?.thread?.title).toBe("Something warm for tonight");
    expect(page?.thread?.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(page?.threads).toHaveLength(1);
  });

  it("answers in the person's language", async () => {
    await signedIn();
    fakeGroq.answer = { reply: "Bien sûr.", picks: [] };
    await assistant.askAssistant({ threadId: null, text: "Une idée ?", locale: "fr" });
    expect(systemPrompt()).toContain("Always answer in French");
  });

  it("gives the try back when the provider fails", async () => {
    const userId = await signedIn();
    fakeGroq.chatFailWith = 503;
    expect(await ask("Anything?")).toEqual({ serverError: "unavailable" });
    expect((await tries.usageFor(userId, "assistant")).used).toBe(0);
    expect(await db().select().from(schema.assistantThreads)).toHaveLength(0);
  });

  it("someone else's conversation looks missing", async () => {
    await signedIn("amina@example.com");
    fakeGroq.answer = { reply: "Hello", picks: [] };
    const { data } = await ask("Hi");
    await signedIn("karim@example.com");
    expect(await ask("Hi again", data!.threadId)).toEqual({ serverError: "not_found" });
    expect((await getAssistantPage(data!.threadId, "en"))?.thread).toBeNull();
    expect(await assistant.deleteAssistantThread({ id: data!.threadId })).toEqual({ serverError: "not_found" });
  });

  it("on Free, the 11th question in a month opens the upgrade sheet", async () => {
    await signedIn();
    fakeGroq.answer = { reply: "Ok", picks: [] };
    for (let i = 0; i < 10; i++) expect((await ask(`Question ${i}`)).data).toBeDefined();
    expect(await ask("One more")).toEqual({ serverError: "quota_exceeded" });
    expect(fakeGroq.chatRequests).toHaveLength(10);
  });
});

describe("history", () => {
  it("can be deleted, and is pruned after 90 days untouched", async () => {
    await signedIn();
    fakeGroq.answer = { reply: "Ok", picks: [] };
    const old = (await ask("Old chat")).data!.threadId;
    const recent = (await ask("Recent chat")).data!.threadId;
    await db()
      .update(schema.assistantThreads)
      .set({ updatedAt: new Date(Date.now() - ASSISTANT_RETENTION_MS - 60_000) })
      .where(eq(schema.assistantThreads.id, old));
    expect(await pruneAssistantHistory()).toBe(1);
    expect(await db().select().from(schema.assistantMessages)).toHaveLength(2);

    expect((await assistant.deleteAssistantThread({ id: recent })).data).toEqual({ id: recent });
    expect(await db().select().from(schema.assistantMessages)).toHaveLength(0);
  });
});
