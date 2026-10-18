// The recipe backup file (PRD §3.2): versioned, ≤ 500 dishes, ≤ 5 MB.
import { z } from "zod";

import { DISH_BOUNDS } from "@/lib/dishes";
import { COLLECTION_NAME_MAX } from "@/server/features/collections/schema";
import { dishInputSchema } from "@/server/features/dishes/schema";

export const BACKUP_FORMAT = "cooky-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_MAX_DISHES = 500;
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

/** One dish in a backup: the dish form's fields plus what's personal to it. */
export const backupDishSchema = dishInputSchema.extend({
  favorite: z.boolean().default(false),
  note: z.string().trim().max(DISH_BOUNDS.noteMax).nullable().default(null),
  collections: z.array(z.string().trim().min(1).max(COLLECTION_NAME_MAX)).max(50).default([]),
});

export type BackupDish = z.infer<typeof backupDishSchema>;

/**
 * The file's envelope. Dishes are checked one by one when the import runs,
 * so one broken dish is skipped instead of failing the whole file.
 */
export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  dishes: z.array(z.unknown()).min(1).max(BACKUP_MAX_DISHES),
});

/** The upload: the file's text, read in the browser. */
export const importBackupSchema = z.object({ content: z.string().max(BACKUP_MAX_BYTES) });
