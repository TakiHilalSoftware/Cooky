import "server-only";

import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { env } from "@/server/env";

import * as schema from "./schema";

type Database = NeonDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Pooled Neon client (WebSocket driver, so `db.transaction` works). Created on
 * first use: pages that never touch the database keep working when
 * DATABASE_URL isn't configured yet, and the error names what's missing.
 */
export function getDb(): Database {
  if (instance) return instance;
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon URL.");
  }
  instance = drizzle({ connection: env.DATABASE_URL, schema });
  return instance;
}
