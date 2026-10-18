import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb, type Executor } from "@/server/db/client";
import {
  backupImports,
  collectionDishes,
  collections,
  dishes,
  dishIngredients,
  dishNotes,
  dishSteps,
  favorites,
} from "@/server/db/schema";
import { loadCollectionAllowance } from "@/server/features/collections/queries";
import { lockCollections } from "@/server/features/collections/write";
import { loadDishAllowance } from "@/server/features/dishes/queries";
import { dishValues, lockDishCount, writeContents } from "@/server/features/dishes/write";
import { normalize } from "@/server/features/ingredients/service";
import { logger } from "@/server/observability/logger";

import { BACKUP_FORMAT, BACKUP_VERSION, backupDishSchema, type BackupDish } from "./schema";

/** Everything in the person's box, as a backup file they can import later (here or after a reset). */
export async function buildBackup(userId: string, now = new Date()) {
  const db = getDb();
  const own = and(eq(dishes.userId, userId), isNull(dishes.deletedAt));
  const rows = await db.select().from(dishes).where(own).orderBy(asc(dishes.createdAt));
  const ids = rows.map((d) => d.id);
  if (ids.length === 0)
    return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), dishes: [] };

  const [lines, steps, stars, notes, memberships] = await Promise.all([
    db
      .select()
      .from(dishIngredients)
      .where(inArray(dishIngredients.dishId, ids))
      .orderBy(asc(dishIngredients.position)),
    db.select().from(dishSteps).where(inArray(dishSteps.dishId, ids)).orderBy(asc(dishSteps.position)),
    db.select({ dishId: favorites.dishId }).from(favorites).where(eq(favorites.userId, userId)),
    db.select({ dishId: dishNotes.dishId, text: dishNotes.text }).from(dishNotes).where(eq(dishNotes.userId, userId)),
    db
      .select({ dishId: collectionDishes.dishId, name: collections.name })
      .from(collectionDishes)
      .innerJoin(collections, eq(collections.id, collectionDishes.collectionId))
      .where(and(eq(collections.userId, userId), isNull(collections.deletedAt))),
  ]);
  const starred = new Set(stars.map((s) => s.dishId));

  const backupDishes: BackupDish[] = rows.map((d) => ({
    ...dishValues(d),
    ingredients: lines
      .filter((l) => l.dishId === d.id)
      .map((l) => ({ name: l.name, amount: l.amount, unit: l.unit, note: l.note })),
    steps: steps
      .filter((s) => s.dishId === d.id)
      .map((s) => ({
        text: s.text,
        timerMinutes: s.timerSeconds === null ? null : Math.round(s.timerSeconds / 60),
        prepDayBefore: s.prepDayBefore,
      })),
    favorite: starred.has(d.id),
    note: notes.find((n) => n.dishId === d.id)?.text ?? null,
    collections: memberships.filter((m) => m.dishId === d.id).map((m) => m.name),
  }));
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), dishes: backupDishes };
}

type Skipped = { duplicate: number; full: number; invalid: number };

/**
 * Runs a queued import (an outbox job). Each dish is checked on its own:
 * broken ones are skipped, dishes already in the box (same name) are skipped,
 * and once the plan's dish cap is reached the rest are skipped too. Safe to
 * run again after a crash: what was imported now counts as "already there".
 */
export async function runBackupImport(importId: string): Promise<void> {
  const db = getDb();
  const [job] = await db
    .select()
    .from(backupImports)
    .where(and(eq(backupImports.id, importId), inArray(backupImports.status, ["queued", "running"])))
    .limit(1);
  if (!job) return; // Already finished, or the account is gone.
  await db.update(backupImports).set({ status: "running" }).where(eq(backupImports.id, job.id));

  const userId = job.userId;
  const items = Array.isArray(job.dishes) ? (job.dishes as unknown[]) : [];
  const existing = new Set(
    (
      await db
        .select({ name: dishes.name })
        .from(dishes)
        .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt)))
    ).map((d) => normalize(d.name)),
  );
  const skipped: Skipped = { duplicate: 0, full: 0, invalid: 0 };
  let imported = 0;

  for (const item of items) {
    const parsed = backupDishSchema.safeParse(item);
    if (!parsed.success) {
      skipped.invalid++;
      continue;
    }
    const dish = parsed.data;
    const key = normalize(dish.name);
    if (existing.has(key)) {
      skipped.duplicate++;
      continue;
    }
    const added = await db.transaction(async (tx) => {
      await lockDishCount(tx, userId);
      if (!(await loadDishAllowance(userId, tx)).canAdd) return false;
      const [row] = await tx
        .insert(dishes)
        .values({ userId, ...dishValues(dish) })
        .returning({ id: dishes.id });
      const dishId = row!.id;
      await writeContents(tx, dishId, dish);
      if (dish.favorite) await tx.insert(favorites).values({ userId, dishId }).onConflictDoNothing();
      if (dish.note) await tx.insert(dishNotes).values({ dishId, userId, text: dish.note });
      for (const name of new Set(dish.collections)) {
        const collectionId = await findOrCreateCollection(tx, userId, name);
        // No room for another collection on this plan: the dish still comes in, just not grouped.
        if (collectionId) await tx.insert(collectionDishes).values({ collectionId, dishId }).onConflictDoNothing();
      }
      return true;
    });
    if (!added) {
      skipped.full++;
      continue;
    }
    existing.add(key);
    imported++;
  }

  await db
    .update(backupImports)
    // The file's dishes aren't kept once imported: only the summary stays.
    .set({ status: "done", imported, skipped, dishes: null, finishedAt: new Date() })
    .where(eq(backupImports.id, job.id));
  logger.info({ importId, imported, skipped }, "backup import finished");
}

/** The person's collection with this name, created if there's room on their plan; null when there isn't. */
async function findOrCreateCollection(tx: Executor, userId: string, name: string): Promise<string | null> {
  await lockCollections(tx, userId);
  const [found] = await tx
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.userId, userId),
        isNull(collections.deletedAt),
        sql`lower(${collections.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (found) return found.id;
  if (!(await loadCollectionAllowance(userId, tx)).canAdd) return null;
  const [created] = await tx.insert(collections).values({ userId, name }).returning({ id: collections.id });
  return created!.id;
}
