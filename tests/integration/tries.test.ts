import { eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const tries = await import("@/server/quota/tries");
const { getEntitlement } = await import("@/server/quota/entitlement");
const { meteredAction } = await import("@/server/actions/_clients");
const schema = await import("@/server/db/schema");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

const OCT = new Date("2026-10-18T12:00:00Z");
const NOV = new Date("2026-11-02T12:00:00Z");

async function newUser(email = "amina@example.com") {
  await signUpAndVerify(email);
  return (await userByEmail(email))!.id;
}

async function givePlan(userId: string, plan: "plus" | "pro", periodStart: Date, periodEnd: Date) {
  await db().insert(schema.entitlements).values({ userId, plan, source: "stripe", periodStart, periodEnd });
}

describe("tries (PRD §3.7)", () => {
  it("gives Free 10 Assistant tries a month, then says the limit is reached", async () => {
    const userId = await newUser();
    for (let i = 0; i < 10; i++) {
      const r = await tries.reserve(userId, "assistant", undefined, OCT);
      expect(r.ok).toBe(true);
      if (r.ok) await tries.commit(r.reservation);
    }
    expect(await tries.reserve(userId, "assistant", undefined, OCT)).toEqual({ ok: false, reason: "quota_exceeded" });

    const usage = await tries.usageFor(userId, "assistant", OCT);
    expect(usage).toMatchObject({ limit: 10, used: 10, remaining: 0 });
    expect(usage.resetsAt).toEqual(new Date("2026-11-01T00:00:00Z"));
  });

  it("never exceeds the limit under parallel requests", async () => {
    const userId = await newUser();
    const results = await Promise.all(
      Array.from({ length: 25 }, () => tries.reserve(userId, "assistant", undefined, OCT)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.filter((r) => !r.ok)).toHaveLength(15);
    const [counter] = await db().select().from(schema.usageCounters).where(eq(schema.usageCounters.userId, userId));
    expect(counter).toMatchObject({ used: 0, reserved: 10 });
  });

  it("gives a try back when the work fails, and settles each reservation only once", async () => {
    const userId = await newUser();
    const r = await tries.reserve(userId, "import", "https://example.com/recipe", OCT);
    if (!r.ok) throw new Error("expected a reservation");
    expect((await tries.usageFor(userId, "import", OCT)).remaining).toBe(4);

    await tries.refund(r.reservation);
    await tries.refund(r.reservation);
    await tries.commit(r.reservation);
    expect(await tries.usageFor(userId, "import", OCT)).toMatchObject({ used: 0, remaining: 5 });

    const [event] = await db()
      .select()
      .from(schema.usageEvents)
      .where(eq(schema.usageEvents.id, r.reservation.eventId));
    expect(event).toMatchObject({ status: "refunded", ref: "https://example.com/recipe" });
  });

  it("starts a fresh allowance in the next month", async () => {
    const userId = await newUser();
    for (let i = 0; i < 5; i++) {
      const r = await tries.reserve(userId, "import", undefined, OCT);
      if (r.ok) await tries.commit(r.reservation);
    }
    expect((await tries.reserve(userId, "import", undefined, OCT)).ok).toBe(false);
    expect((await tries.reserve(userId, "import", undefined, NOV)).ok).toBe(true);
  });

  it("counts spins per day", async () => {
    const userId = await newUser();
    for (let i = 0; i < 3; i++) expect((await tries.reserve(userId, "spins", undefined, OCT)).ok).toBe(true);
    expect((await tries.reserve(userId, "spins", undefined, OCT)).ok).toBe(false);
    expect((await tries.reserve(userId, "spins", undefined, new Date("2026-10-19T00:00:01Z"))).ok).toBe(true);
  });

  it("uses the paid plan's limits, in monthly windows from the billing day", async () => {
    const userId = await newUser();
    await givePlan(userId, "plus", new Date("2026-10-15T09:00:00Z"), new Date("2026-11-15T09:00:00Z"));
    const usage = await tries.usageFor(userId, "assistant", OCT);
    expect(usage).toMatchObject({ limit: 150, remaining: 150 });
    expect(usage.resetsAt).toEqual(new Date("2026-11-15T09:00:00Z"));
  });

  it("treats Pro's unlimited spins as unlimited", async () => {
    const userId = await newUser();
    await givePlan(userId, "pro", new Date("2026-10-01Z"), new Date("2026-11-01Z"));
    for (let i = 0; i < 30; i++) expect((await tries.reserve(userId, "spins", undefined, OCT)).ok).toBe(true);
    expect((await tries.usageFor(userId, "spins", OCT)).remaining).toBeNull();
  });

  it("falls back to Free when a paid entitlement is stale", async () => {
    const userId = await newUser();
    await givePlan(userId, "plus", new Date("2026-08-01Z"), new Date("2026-09-01Z"));
    expect((await getEntitlement(userId, OCT)).plan).toBe("free");
  });

  it("releases reservations whose request never reported back", async () => {
    const userId = await newUser();
    const r = await tries.reserve(userId, "voice", undefined, OCT);
    if (!r.ok) throw new Error("expected a reservation");
    expect(await tries.releaseStaleReservations(new Date(OCT.getTime() + 60_000))).toBe(0);
    expect(await tries.releaseStaleReservations(new Date(OCT.getTime() + 6 * 60_000))).toBe(1);
    expect((await tries.usageFor(userId, "voice", OCT)).remaining).toBe(10);
  });
});

describe("counted and gated features", () => {
  it("caps how many dishes a Free account can add", async () => {
    const userId = await newUser();
    expect(await tries.canAddAnother(userId, "dishes", 49)).toEqual({ ok: true });
    expect(await tries.canAddAnother(userId, "dishes", 50)).toEqual({ ok: false, reason: "quota_exceeded" });
  });

  it("unlocks plan-only features on the right plan", async () => {
    const userId = await newUser();
    expect(await tries.hasFeature(userId, "household_list")).toBe(false);
    expect(await tries.hasFeature(userId, "backup_import")).toBe(false);
    await givePlan(userId, "plus", new Date(), new Date(Date.now() + 30 * 86_400_000));
    expect(await tries.hasFeature(userId, "backup_import")).toBe(true);
    expect(await tries.hasFeature(userId, "household_list")).toBe(false);
    expect(await tries.canAddAnother(userId, "collections", 999)).toEqual({ ok: true });
  });
});

describe("meteredAction", () => {
  const work = vi.fn();
  const importRecipe = meteredAction("import")
    .metadata({ actionName: "importRecipe" })
    .inputSchema(z.object({ outcome: z.enum(["ok", "throws", "error-code"]) }))
    .action(async ({ parsedInput }) => {
      work();
      if (parsedInput.outcome === "throws") throw new Error("provider down");
      if (parsedInput.outcome === "error-code") returnServerError("unavailable");
      return { imported: true };
    });

  async function signedIn() {
    await newUser();
    await logIn();
  }

  it("spends a try only when the work succeeds", async () => {
    await signedIn();
    const userId = (await userByEmail("amina@example.com"))!.id;
    expect(await importRecipe({ outcome: "ok" })).toEqual({ data: { imported: true } });
    expect(await importRecipe({ outcome: "throws" })).toEqual({ serverError: "unavailable" });
    expect(await importRecipe({ outcome: "error-code" })).toEqual({ serverError: "unavailable" });
    expect(await tries.usageFor(userId, "import")).toMatchObject({ used: 1, remaining: 4 });
  });

  it("stops before the work when the tries are used up", async () => {
    await signedIn();
    for (let i = 0; i < 5; i++) await importRecipe({ outcome: "ok" });
    work.mockClear();
    expect(await importRecipe({ outcome: "ok" })).toEqual({ serverError: "quota_exceeded" });
    expect(work).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    expect(await importRecipe({ outcome: "ok" })).toEqual({ serverError: "unauthorized" });
  });
});
