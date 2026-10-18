import { afterEach, describe, expect, it, vi } from "vitest";

/** docs/SETUP_KEYS.md: "The client column is the complete list of variables that may reach the browser." */
const DOCUMENTED_CLIENT_VARIABLES = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
];

/** Everything a deployed build needs (docs/SETUP_KEYS.md, "Prod" column). */
const DEPLOYED_REQUIRED = {
  NEXT_PUBLIC_APP_URL: "https://cooky.example",
  DATABASE_URL: "postgres://user:pw@pool.db.example/cooky",
  DATABASE_URL_UNPOOLED: "postgres://user:pw@db.example/cooky",
  BETTER_AUTH_SECRET: "x".repeat(48),
  BETTER_AUTH_URL: "https://cooky.example",
  CRON_SECRET: "c".repeat(64),
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  RESEND_API_KEY: "re_test_123",
  EMAIL_FROM: "Cooky <hello@cooky.example>",
  UPSTASH_REDIS_REST_URL: "https://redis.upstash.example",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  QSTASH_TOKEN: "qstash-token",
  QSTASH_CURRENT_SIGNING_KEY: "sig-current",
  QSTASH_NEXT_SIGNING_KEY: "sig-next",
};

async function loadEnv() {
  vi.resetModules();
  return import("./env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("exposes exactly the documented public allow-list to the client", async () => {
    const { clientSchema } = await loadEnv();
    expect(Object.keys(clientSchema).sort()).toEqual([...DOCUMENTED_CLIENT_VARIABLES].sort());
  });

  it("keeps secrets out of the client schema", async () => {
    const { clientSchema, serverSchema } = await loadEnv();
    for (const key of Object.keys(serverSchema)) {
      expect(key.startsWith("NEXT_PUBLIC_"), key).toBe(false);
      expect(Object.keys(clientSchema)).not.toContain(key);
    }
  });

  it.each([
    [{ VERCEL_ENV: "production" }, true],
    [{ VERCEL_ENV: "preview" }, true],
    [{ COOKY_STRICT_ENV: "1" }, true],
    [{ VERCEL_ENV: "development" }, false],
    [{}, false],
  ])("isStrictEnv(%j) is %s", async (source, expected) => {
    const { isStrictEnv } = await loadEnv();
    expect(isStrictEnv(source)).toBe(expected);
  });

  it("boots locally without third-party accounts", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { env } = await loadEnv();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it.each(Object.keys(DEPLOYED_REQUIRED))("refuses to boot a deployed build without %s", async (missing) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("VERCEL_ENV", "production");
    for (const [key, value] of Object.entries(DEPLOYED_REQUIRED)) vi.stubEnv(key, key === missing ? "" : value);
    await expect(loadEnv()).rejects.toThrow(/invalid environment variables/i);
  });

  it("rejects a weak auth secret even locally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("BETTER_AUTH_SECRET", "too-short");
    await expect(loadEnv()).rejects.toThrow(/invalid environment variables/i);
  });

  it("boots a deployed build once every required variable is set", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    for (const [key, value] of Object.entries(DEPLOYED_REQUIRED)) vi.stubEnv(key, value);
    const { env } = await loadEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://cooky.example");
  });

  it("rejects a Pusher cluster that could smuggle extra CSP hosts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_PUSHER_CLUSTER", "eu.evil.com wss://attacker");
    await expect(loadEnv()).rejects.toThrow(/invalid environment variables/i);
  });
});
