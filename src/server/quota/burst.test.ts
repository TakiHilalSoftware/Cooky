import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, limit } = vi.hoisted(() => ({
  env: {
    NODE_ENV: "development",
    UPSTASH_REDIS_REST_URL: "https://redis.upstash.example",
    UPSTASH_REDIS_REST_TOKEN: "t",
  },
  limit: vi.fn(),
}));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/observability/logger", () => ({ logger: { info: vi.fn() } }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    class {
      limit = limit;
    },
    { slidingWindow: () => ({}) },
  ),
}));

const { withinBurstLimit } = await import("./burst");

beforeEach(() => limit.mockReset());

describe("withinBurstLimit", () => {
  it.each(["development", "test"])("never limits in %s, even with Upstash configured", async (nodeEnv) => {
    env.NODE_ENV = nodeEnv;
    expect(await withinBurstLimit("signupIp", "203.0.113.7")).toBe(true);
    expect(limit).not.toHaveBeenCalled();
  });

  it("enforces the rule in production", async () => {
    env.NODE_ENV = "production";
    limit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    expect(await withinBurstLimit("signupIp", "203.0.113.7")).toBe(true);
    expect(await withinBurstLimit("signupIp", "203.0.113.7")).toBe(false);
    expect(limit).toHaveBeenCalledWith("203.0.113.7");
  });
});
