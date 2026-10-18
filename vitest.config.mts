import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const stub = (file: string) => fileURLToPath(new URL(`./tests/setup/${file}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside React's server graph; tests import server
    // modules directly, so it becomes a no-op here (and only here).
    alias: { "server-only": stub("server-only.ts") },
  },
  test: {
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/lint/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./tests/setup/component.ts"],
        },
      },
      {
        extends: true,
        // Actions against a real Postgres; populated from Phase 1 (needs DATABASE_URL).
        test: { name: "integration", environment: "node", include: ["tests/integration/**/*.test.ts"] },
      },
    ],
  },
});
