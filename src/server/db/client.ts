import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/server/env";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction: what write helpers accept. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { cookyDb?: Database };

/**
 * Pooled Postgres client. node-postgres speaks to local Postgres in
 * development and to Neon's pooled endpoint in production, so both run the
 * same driver and the same SQL. Created on first use, so pages that never touch
 * the database keep working before DATABASE_URL is configured. The instance
 * lives on globalThis so dev hot reloads don't leak pools.
 */
export function getDb(): Database {
  if (globalForDb.cookyDb) return globalForDb.cookyDb;
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your database URL.");
  }
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10, idleTimeoutMillis: 10_000 });
  globalForDb.cookyDb = drizzle({ client: pool, schema, casing: "snake_case" });
  return globalForDb.cookyDb;
}
