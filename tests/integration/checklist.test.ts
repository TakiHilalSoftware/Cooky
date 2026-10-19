import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const { getChecklist } = await import("@/server/features/checklist/queries");
const { dismissChecklist } = await import("@/server/actions/checklist");
const kitchen = await import("@/server/actions/kitchen");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

const done = async () =>
  Object.fromEntries((await getChecklist())!.steps.map((s) => [s.step, s.done])) as Record<string, boolean>;

describe("first-week checklist", () => {
  it("ticks steps off from what the person actually did", async () => {
    await signUpAndVerify();
    await logIn();
    expect(await done()).toEqual({ dishes: false, kitchen: false, cook: false, plan: false, friend: false });
    await kitchen.addPantryItems({ names: ["Tomatoes"], staple: false });
    expect((await done()).kitchen).toBe(true);
  });

  it("goes away when hidden, and after the first two weeks", async () => {
    await signUpAndVerify();
    await logIn();
    await dismissChecklist({});
    expect(await getChecklist()).toBeNull();

    const user = await userByEmail("amina@example.com");
    await db().update(schema.profiles).set({ checklistDismissedAt: null }).where(eq(schema.profiles.userId, user!.id));
    expect(await getChecklist()).not.toBeNull();
    await db()
      .update(schema.user)
      .set({ createdAt: sql`now() - interval '15 days'` })
      .where(eq(schema.user.id, user!.id));
    expect(await getChecklist()).toBeNull();
  });
});
