import { afterEach, describe, expect, it, vi } from "vitest";

/** docs/SETUP_KEYS.md: "The client column is the complete list of variables that may reach the browser." */
const DOCUMENTED_CLIENT_VARIABLES = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
];

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

  it("refuses to boot a deployed build with a required variable missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cooky.example");
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgres://user:pw@db.example/cooky");
    vi.stubEnv("DATABASE_URL", "");
    await expect(loadEnv()).rejects.toThrow(/invalid environment variables/i);
  });

  it("boots a deployed build once every required variable is set", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cooky.example");
    vi.stubEnv("DATABASE_URL", "postgres://user:pw@pool.db.example/cooky");
    vi.stubEnv("DATABASE_URL_UNPOOLED", "postgres://user:pw@db.example/cooky");
    const { env } = await loadEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://cooky.example");
  });

  it("rejects a Pusher cluster that could smuggle extra CSP hosts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_PUSHER_CLUSTER", "eu.evil.com wss://attacker");
    await expect(loadEnv()).rejects.toThrow(/invalid environment variables/i);
  });
});
