import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Executor } from "@/server/db/client";
import { collections } from "@/server/db/schema";

// Shared by the collection actions and the backup import.

/** Serialises collection-count changes per person, so parallel creates can't pass the cap. */
export async function lockCollections(tx: Executor, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`collections:${userId}`}, 0))`);
}

/** Another live collection of the person's already has this name (case-insensitive). */
export async function nameTaken(tx: Executor, userId: string, name: string, exceptId?: string) {
  const [row] = await tx
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.userId, userId),
        isNull(collections.deletedAt),
        sql`lower(${collections.name}) = lower(${name})`,
        exceptId ? ne(collections.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}
