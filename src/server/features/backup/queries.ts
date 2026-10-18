import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { backupImports, dishes } from "@/server/db/schema";
import { hasFeature } from "@/server/quota/tries";

import type { BackupImportDto, BackupOverviewDto } from "./dto";

const NO_SKIPS = { duplicate: 0, full: 0, invalid: 0 };

/** Settings → Your data: what a backup would hold, whether import is on the plan, and the last import. */
export const getBackupOverview = cache(async (): Promise<BackupOverviewDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const db = getDb();
  const [[dishCount], canImport, [latest]] = await Promise.all([
    db
      .select({ n: count() })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt))),
    hasFeature(userId, "backup_import"),
    db
      .select({
        status: backupImports.status,
        total: backupImports.total,
        imported: backupImports.imported,
        skipped: backupImports.skipped,
        createdAt: backupImports.createdAt,
      })
      .from(backupImports)
      .where(eq(backupImports.userId, userId))
      .orderBy(desc(backupImports.createdAt))
      .limit(1),
  ]);
  const latestImport: BackupImportDto | null = latest
    ? {
        status: latest.status,
        total: latest.total,
        imported: latest.imported,
        skipped: { ...NO_SKIPS, ...latest.skipped },
        createdAt: latest.createdAt.toISOString(),
      }
    : null;
  return { dishCount: dishCount?.n ?? 0, canImport, latestImport };
});
