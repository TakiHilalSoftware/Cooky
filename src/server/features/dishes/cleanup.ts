import "server-only";

import { and, inArray, isNotNull, lt, ne } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { backupImports, collections, dishes, messages } from "@/server/db/schema";
import { removePhotos } from "@/server/storage/photos";

/** Deleted dishes and collections stay restorable this long (the Undo toast lasts 6 s; this covers retries and other tabs). */
export const DELETED_TTL_MS = 24 * 60 * 60 * 1000;
/** Finished backup import summaries are shown for a while, then removed. */
export const BACKUP_IMPORT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The daily cleanup: dishes and collections deleted more than a day ago (with
 * everything attached, by FK cascade), old backup import summaries, and the
 * text of deleted messages (the bubble stays as "Message deleted").
 */
export async function purgeDeleted(now = new Date()) {
  const db = getDb();
  const deletedBefore = new Date(now.getTime() - DELETED_TTL_MS);
  const [purgedDishes, purgedCollections, purgedImports, wipedMessages] = await Promise.all([
    db
      .delete(dishes)
      .where(and(isNotNull(dishes.deletedAt), lt(dishes.deletedAt, deletedBefore)))
      .returning({ id: dishes.id, imageKey: dishes.imageKey }),
    db
      .delete(collections)
      .where(and(isNotNull(collections.deletedAt), lt(collections.deletedAt, deletedBefore)))
      .returning({ id: collections.id }),
    db
      .delete(backupImports)
      .where(
        and(
          inArray(backupImports.status, ["done", "failed"]),
          lt(backupImports.createdAt, new Date(now.getTime() - BACKUP_IMPORT_TTL_MS)),
        ),
      )
      .returning({ id: backupImports.id }),
    db
      .update(messages)
      .set({ content: "", dishId: null })
      .where(and(isNotNull(messages.deletedAt), lt(messages.deletedAt, deletedBefore), ne(messages.content, "")))
      .returning({ id: messages.id }),
  ]);
  await removePhotos(purgedDishes.map((d) => d.imageKey));
  return {
    dishes: purgedDishes.length,
    collections: purgedCollections.length,
    imports: purgedImports.length,
    messages: wipedMessages.length,
  };
}
