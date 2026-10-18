"use server";

import { and, eq, inArray } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { backupImports } from "@/server/db/schema";
import type { BackupExportDto, ImportBackupResult } from "@/server/features/backup/dto";
import {
  BACKUP_MAX_BYTES,
  BACKUP_MAX_DISHES,
  backupFileSchema,
  importBackupSchema,
} from "@/server/features/backup/schema";
import { buildBackup } from "@/server/features/backup/service";
import { drainSoon, enqueue } from "@/server/outbox/enqueue";
import { hasFeature } from "@/server/quota/tries";

import { userAction } from "./_clients";

/** Downloads the whole recipe box as a versioned Cooky file (every plan). */
export const exportBackup = userAction
  .metadata({ actionName: "exportBackup" })
  .action(async ({ ctx }): Promise<BackupExportDto> => {
    const now = new Date();
    const backup = await buildBackup(ctx.user.id, now);
    return {
      filename: `cooky-recipes-${now.toISOString().slice(0, 10)}.json`,
      content: JSON.stringify(backup, null, 2),
    };
  });

/**
 * Checks a backup file and queues it (PRD §3.2): the dishes are imported in
 * the background and the page shows the result. Import is a paid feature
 * (`plan_limits.backup_import`); on Free the upgrade sheet opens.
 */
export const importBackup = userAction
  .metadata({ actionName: "importBackup" })
  .inputSchema(importBackupSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<ImportBackupResult> => {
    if (!(await hasFeature(ctx.user.id, "backup_import"))) returnServerError<ActionErrorCode>("plan_required");
    // The schema caps characters; the limit is about bytes (Arabic text is 2 bytes a letter).
    if (Buffer.byteLength(input.content, "utf8") > BACKUP_MAX_BYTES) return { status: "invalid", problem: "too_large" };

    let raw: unknown;
    try {
      raw = JSON.parse(input.content);
    } catch {
      return { status: "invalid", problem: "not_json" };
    }
    const file = backupFileSchema.safeParse(raw);
    if (!file.success) {
      // Say what's wrong in the person's terms: not a Cooky file, empty, or too big.
      const shape = z.object({ dishes: z.array(z.unknown()) }).safeParse(raw);
      const count = shape.success ? shape.data.dishes.length : null;
      if (count === 0) return { status: "invalid", problem: "empty" };
      if (count !== null && count > BACKUP_MAX_DISHES) return { status: "invalid", problem: "too_many" };
      return { status: "invalid", problem: "wrong_format" };
    }

    const db = getDb();
    const queued = await db.transaction(async (tx) => {
      const [running] = await tx
        .select({ id: backupImports.id })
        .from(backupImports)
        .where(and(eq(backupImports.userId, ctx.user.id), inArray(backupImports.status, ["queued", "running"])))
        .limit(1);
      if (running) return null;
      const [row] = await tx
        .insert(backupImports)
        .values({ userId: ctx.user.id, dishes: file.data.dishes, total: file.data.dishes.length })
        .returning({ id: backupImports.id });
      await enqueue(tx, { kind: "backup_import", payload: { importId: row!.id } });
      return row!.id;
    });
    if (!queued) return { status: "busy" };
    drainSoon();
    revalidatePath("/[locale]/settings/data", "page");
    return { status: "queued", total: file.data.dishes.length };
  });
