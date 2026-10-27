import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/pitch-belief-machine.spec.ts",
  tsconfig: "./e2e/tsconfig.json",
  outputDir: "./pitch-video",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1920, height: 1080 },
    video: {
      mode: "on",
      size: { width: 1920, height: 1080 },
    },
    storageState: "e2e/.auth/pitch-user.json",
    trace: "off",
  },
  projects: [
    {
      name: "pitch",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
