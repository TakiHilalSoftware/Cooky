import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: vi.fn() }));
vi.mock("./handlers", () => ({ handleJob: vi.fn() }));

const { backoffMinutes, MAX_ATTEMPTS } = await import("./drain");
const { outboxJobSchema } = await import("./jobs");

describe("backoffMinutes", () => {
  it("doubles each attempt and caps at an hour", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoffMinutes)).toEqual([1, 2, 4, 8, 16, 32, 60, 60]);
  });

  it("gives up after 8 attempts (ARCHITECTURE §5.12)", () => {
    expect(MAX_ATTEMPTS).toBe(8);
  });
});

describe("outboxJobSchema", () => {
  it("accepts a well-formed email job", () => {
    const job = {
      kind: "email",
      payload: { template: "verifyEmail", userId: "u1", to: "a@b.co", url: "https://x.test/v?t=1" },
    };
    expect(outboxJobSchema.parse(job)).toEqual(job);
  });

  it("rejects unknown templates and malformed recipients", () => {
    expect(
      outboxJobSchema.safeParse({ kind: "email", payload: { template: "spam", userId: "u1", to: "a@b.co" } }).success,
    ).toBe(false);
    expect(
      outboxJobSchema.safeParse({ kind: "email", payload: { template: "verifyEmail", userId: "u1", to: "nope" } })
        .success,
    ).toBe(false);
  });
});
