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
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_123",
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

describe("EMAIL_FROM", () => {
  it("lets a local app boot with an unusable sender (only email is affected)", async () => {
    vi.stubEnv("EMAIL_FROM", "angel@gmail.com");
    const { env } = await loadEnv();
    expect(env.EMAIL_FROM).toBe("angel@gmail.com");
  });

  it.each(["angel@gmail.com", "Cooky <someone@outlook.com>", "Cooky", "Cooky <not-an-email>"])(
    "fails a deployed build with sender %j, explaining the fix",
    async (from) => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("VERCEL_ENV", "production");
      for (const [key, value] of Object.entries(DEPLOYED_REQUIRED)) vi.stubEnv(key, value);
      vi.stubEnv("EMAIL_FROM", from);
      await expect(loadEnv()).rejects.toThrow(/invalid environment variables/i);
      expect(JSON.stringify(logged.mock.calls)).toContain("EMAIL_FROM");
    },
  );
});

describe("emailFromProblem", () => {
  it.each(["Cooky <onboarding@resend.dev>", "hello@cooky.example", "Cooky <Hello@Mail.Cooky.example>"])(
    "accepts %s",
    async (from) => {
      const { emailFromProblem } = await loadEnv();
      expect(emailFromProblem(from)).toBeNull();
    },
  );

  it("explains why a public mail domain can't work and what to use instead", async () => {
    const { emailFromProblem } = await loadEnv();
    const problem = emailFromProblem("angel@gmail.com");
    expect(problem).toContain("gmail.com");
    expect(problem).toContain("onboarding@resend.dev");
  });

  it("explains the expected shape of a malformed sender", async () => {
    const { emailFromProblem } = await loadEnv();
    expect(emailFromProblem("Cooky")).toContain("Cooky <hello@yourdomain.com>");
  });
});

describe("senderAddress", () => {
  it.each([
    ["Cooky <Hello@Cooky.example>", "hello@cooky.example"],
    ["Cooky <hello@cooky.example>   ", "hello@cooky.example"],
    ["hello@cooky.example", "hello@cooky.example"],
    ["Cooky", null],
    ["Cooky <nope>", null],
  ])("%j → %j", async (value, expected) => {
    const { senderAddress } = await loadEnv();
    expect(senderAddress(value)).toBe(expected);
  });
});
