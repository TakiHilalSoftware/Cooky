import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dishes } from "@/server/db/schema";
import { fetchImage } from "@/server/importer/fetch";
import { logger } from "@/server/observability/logger";
import { MAX_PHOTO_BYTES } from "@/server/storage/image";
import { removePhotos, storePhoto } from "@/server/storage/photos";
import { storageConfigured } from "@/server/storage/r2";

/**
 * Copies an imported recipe's photo into storage when the dish is saved
 * (ARCHITECTURE §5.14). The fetch goes through the importer's SSRF guard and
 * the bytes through the same checks as an upload. Any failure just leaves the
 * dish without a photo.
 */
export async function copyImportedPhoto(userId: string, dishId: string, imageUrl: string): Promise<void> {
  if (!storageConfigured()) return;
  let key: string;
  try {
    key = await storePhoto(userId, await fetchImage(imageUrl, MAX_PHOTO_BYTES), "dish");
  } catch (err) {
    logger.info({ err: err instanceof Error ? err.message : "unknown" }, "imported photo skipped");
    return;
  }
  // Only fills an empty slot: the person may have added their own photo meanwhile.
  const updated = await getDb()
    .update(dishes)
    .set({ imageKey: key })
    .where(and(eq(dishes.id, dishId), eq(dishes.userId, userId), isNull(dishes.imageKey)))
    .returning({ id: dishes.id });
  if (updated.length === 0) await removePhotos([key]);
}
