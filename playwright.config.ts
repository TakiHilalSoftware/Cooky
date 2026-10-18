import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides TEST_DATABASE_URL directly.
}

// Port 3100 so a `pnpm dev` on 3000 is never disturbed. Set E2E_BASE_URL to
// run the same specs against a Vercel preview instead of a local build.
const PORT = 3100;
const LOCAL_URL = `http://localhost:${PORT}`;
const baseURL = process.env.E2E_BASE_URL ?? LOCAL_URL;

export default defineConfig({
  testDir: "./e2e",
  // A fresh cooky_test database, built from the migrations (same as integration tests).
  globalSetup: process.env.E2E_BASE_URL ? undefined : "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: `${baseURL}/en`,
        reuseExistingServer: false,
        timeout: 120_000,
        // The local build runs against the test database, with links on this
        // port and every outbound integration off: emails are written to the
        // outbox (the specs read links from there), never sent.
        env: {
          DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
          DATABASE_URL_UNPOOLED: process.env.TEST_DATABASE_URL ?? "",
          BETTER_AUTH_URL: LOCAL_URL,
          RESEND_API_KEY: "",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
          QSTASH_TOKEN: "",
          QSTASH_CURRENT_SIGNING_KEY: "",
          QSTASH_NEXT_SIGNING_KEY: "",
        },
      },
});
