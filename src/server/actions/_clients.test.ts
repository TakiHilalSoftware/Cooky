import { returnServerError } from "next-safe-action";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";

const { logError, captureException, getSession, withinBurstLimit } = vi.hoisted(() => ({
  logError: vi.fn(),
  captureException: vi.fn(),
  getSession: vi.fn(),
  withinBurstLimit: vi.fn(),
}));

vi.mock("@/server/observability/logger", () => ({ logger: { error: logError } }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@/server/auth/session", () => ({ getSession }));
vi.mock("@/server/quota/burst", () => ({ withinBurstLimit }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));

const { publicAction, userAction } = await import("./_clients");

const activeSession = { user: { id: "u1", email: "amina@example.com", name: "Amina" }, session: { id: "s1" } };

beforeEach(() => {
  logError.mockClear();
  captureException.mockClear();
  getSession.mockReset();
  withinBurstLimit.mockReset().mockResolvedValue(true);
});

describe("publicAction", () => {
  it("returns the handler's data on success", async () => {
    const greet = publicAction
      .metadata({ actionName: "greet" })
      .inputSchema(z.object({ name: z.string().trim().min(1).max(20) }))
      .action(async ({ parsedInput }) => ({ greeting: `Hello ${parsedInput.name}` }));

    await expect(greet({ name: "  Amina " })).resolves.toEqual({ data: { greeting: "Hello Amina" } });
  });

  it("turns an unexpected failure into `unavailable` without leaking details", async () => {
    const boom = publicAction.metadata({ actionName: "boom" }).action(async () => {
      throw new Error("connect ECONNREFUSED postgres://admin:hunter2@10.0.0.5/cooky");
    });

    const result = await boom();

    expect(result).toEqual({ serverError: "unavailable" });
    expect(JSON.stringify(result)).not.toMatch(/hunter2|ECONNREFUSED|postgres/);
    expect(logError).toHaveBeenCalledOnce();
    expect(logError.mock.calls[0]?.[0]).toMatchObject({ actionName: "boom" });
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("passes an expected error code through unchanged and doesn't report it", async () => {
    const guarded = publicAction.metadata({ actionName: "guarded" }).action(async () => {
      returnServerError<ActionErrorCode>("forbidden");
    });

    await expect(guarded()).resolves.toEqual({ serverError: "forbidden" });
    expect(logError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("rejects invalid input before the handler runs", async () => {
    const handler = vi.fn();
    const save = publicAction
      .metadata({ actionName: "save" })
      .inputSchema(z.object({ name: z.string().max(5) }))
      .action(handler);

    const result = await save({ name: "far too long" });

    expect(result.validationErrors).toBeDefined();
    expect(result.serverError).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("userAction", () => {
  const whoAmI = userAction
    .metadata({ actionName: "whoAmI" })
    .action(async ({ ctx }) => ({ id: ctx.user.id, ip: ctx.ip }));

  it("rejects callers without a valid session before the handler runs", async () => {
    getSession.mockResolvedValue(null);
    await expect(whoAmI()).resolves.toEqual({ serverError: "unauthorized" });
  });

  it("gives the handler the signed-in user and the client IP", async () => {
    getSession.mockResolvedValue(activeSession);
    await expect(whoAmI()).resolves.toEqual({ data: { id: "u1", ip: "203.0.113.7" } });
    expect(withinBurstLimit).toHaveBeenCalledWith("userWrite", "u1");
  });

  it("stops callers over their burst limit with rate_limited", async () => {
    getSession.mockResolvedValue(activeSession);
    withinBurstLimit.mockResolvedValue(false);
    await expect(whoAmI()).resolves.toEqual({ serverError: "rate_limited" });
  });
});
