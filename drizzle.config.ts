import { defineConfig } from "drizzle-kit";

// Migrations use the direct (unpooled) connection, per docs/SETUP_KEYS.md §1.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? "" },
  strict: true,
  verbose: true,
});
