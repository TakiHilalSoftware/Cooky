"use server";

import { and, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";

import type { ActionErrorCode } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { clearFailedLogins } from "@/server/auth/lockout";
import { recomputeEntitlement } from "@/server/billing/entitlements";
import { getDb, type Executor } from "@/server/db/client";
import {
  catalogDishes,
  catalogIngredients,
  catalogSteps,
  dishes,
  dishGroups,
  dishRatings,
  entitlements,
  feedback,
  messages,
  reports,
  session,
  user,
} from "@/server/db/schema";
import { scheduleDeletion } from "@/server/features/account/deletion";
import {
  adminCompSchema,
  adminRoleSchema,
  adminSuspendSchema,
  adminUserSchema,
  catalogDishSchema,
  feedbackStatusSchema,
  idSchema,
  resolveReportSchema,
  type CatalogDishInput,
} from "@/server/features/admin/schema";
import { resolveIngredientIds } from "@/server/features/ingredients/dictionary";
import { drainSoon, enqueue } from "@/server/outbox/enqueue";
import { removePhotos } from "@/server/storage/photos";

import { adminAction } from "./_clients";

function refresh() {
  revalidatePath("/[locale]/admin", "layout");
}

/** The account an admin action targets, refusing the admin's own where it matters. */
async function targetUser(tx: Executor, adminId: string, userId: string, notSelf: boolean) {
  if (notSelf && userId === adminId) returnServerError<ActionErrorCode>("forbidden");
  const [row] = await tx.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!row) returnServerError<ActionErrorCode>("not_found");
  return row;
}

export const adminMarkVerified = adminAction
  .metadata({ actionName: "adminMarkVerified" })
  .inputSchema(adminUserSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await targetUser(tx, ctx.user.id, userId, false);
      await tx.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.user_verified",
        targetType: "user",
        targetId: userId,
        ip: ctx.ip,
      });
    });
    refresh();
    return { userId };
  });

/** Lifts a failed-login lockout. */
export const adminUnlock = adminAction
  .metadata({ actionName: "adminUnlock" })
  .inputSchema(adminUserSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const target = await targetUser(tx, ctx.user.id, userId, false);
      await clearFailedLogins(target.email);
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.user_unlocked",
        targetType: "user",
        targetId: userId,
        ip: ctx.ip,
      });
    });
    refresh();
    return { userId };
  });

export const adminSignOutEverywhere = adminAction
  .metadata({ actionName: "adminSignOutEverywhere" })
  .inputSchema(adminUserSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await targetUser(tx, ctx.user.id, userId, true);
      await tx.delete(session).where(eq(session.userId, userId));
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.user_signed_out",
        targetType: "user",
        targetId: userId,
        ip: ctx.ip,
      });
    });
    refresh();
    return { userId };
  });

/** Suspend = Better Auth's ban: refused at sign-in, signed out everywhere, invisible to others. */
export const adminSetSuspended = adminAction
  .metadata({ actionName: "adminSetSuspended" })
  .inputSchema(adminSuspendSchema)
  .action(async ({ parsedInput: { userId, suspended }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await targetUser(tx, ctx.user.id, userId, true);
      await suspend(tx, ctx.user.id, userId, suspended, ctx.ip);
    });
    refresh();
    return { userId, suspended };
  });

async function suspend(tx: Executor, adminId: string, userId: string, suspended: boolean, ip: string) {
  await tx
    .update(user)
    .set({ banned: suspended, banReason: suspended ? "admin" : null, banExpires: null })
    .where(eq(user.id, userId));
  if (suspended) await tx.delete(session).where(eq(session.userId, userId));
  await audit(tx, {
    actorId: adminId,
    action: suspended ? "admin.user_suspended" : "admin.user_unsuspended",
    targetType: "user",
    targetId: userId,
    ip,
  });
}

/** Make or revoke admin. Admins can't demote themselves (PRD §3.8). */
export const adminSetRole = adminAction
  .metadata({ actionName: "adminSetRole" })
  .inputSchema(adminRoleSchema)
  .action(async ({ parsedInput: { userId, admin }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await targetUser(tx, ctx.user.id, userId, true);
      await tx
        .update(user)
        .set({ role: admin ? "admin" : "user" })
        .where(eq(user.id, userId));
      await audit(tx, {
        actorId: ctx.user.id,
        action: admin ? "admin.role_granted" : "admin.role_revoked",
        targetType: "user",
        targetId: userId,
        ip: ctx.ip,
      });
    });
    refresh();
    return { userId, admin };
  });

/**
 * A complimentary plan (PRD §3.8), for some months or until revoked. Billing
 * never downgrades a running comp; revoking hands the plan back to Stripe.
 */
export const adminGrantComp = adminAction
  .metadata({ actionName: "adminGrantComp" })
  .inputSchema(adminCompSchema)
  .action(async ({ parsedInput: { userId, plan, months }, ctx }) => {
    const now = new Date();
    await getDb().transaction(async (tx) => {
      await targetUser(tx, ctx.user.id, userId, false);
      if (plan === null) {
        await tx.delete(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.source, "comp")));
        await recomputeEntitlement(userId, tx, now);
      } else {
        const periodEnd = months === 0 ? null : new Date(new Date(now).setUTCMonth(now.getUTCMonth() + months));
        const values = { plan, source: "comp" as const, periodStart: now, periodEnd };
        await tx
          .insert(entitlements)
          .values({ userId, ...values })
          .onConflictDoUpdate({ target: entitlements.userId, set: values });
      }
      await audit(tx, {
        actorId: ctx.user.id,
        action: plan ? "admin.comp_granted" : "admin.comp_revoked",
        targetType: "user",
        targetId: userId,
        meta: plan ? { plan, months } : undefined,
        ip: ctx.ip,
      });
    });
    refresh();
    return { userId, plan };
  });

/**
 * Deletes an account now (the UI confirms first). It's signed out at once;
 * the purge (Stripe customer, stored files, rows) runs from the outbox.
 */
export const adminDeleteUser = adminAction
  .metadata({ actionName: "adminDeleteUser" })
  .inputSchema(adminUserSchema)
  .action(async ({ parsedInput: { userId }, ctx }) => {
    await getDb().transaction(async (tx) => {
      await targetUser(tx, ctx.user.id, userId, true);
      await scheduleDeletion(tx, userId);
      // Banned too, so logging in before the purge runs can't cancel an admin's deletion.
      await tx.update(user).set({ banned: true, banReason: "deleted" }).where(eq(user.id, userId));
      await enqueue(tx, { kind: "account_purge", payload: { userId, actorId: ctx.user.id } });
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.user_deleted",
        targetType: "user",
        targetId: userId,
        ip: ctx.ip,
      });
    });
    drainSoon();
    refresh();
    return { userId };
  });

const orNull = (text: string) => (text.trim() ? text.trim() : null);

async function writeCatalogContents(tx: Executor, dishId: string, input: CatalogDishInput) {
  const ingredientIds = await resolveIngredientIds(input.ingredients.map((i) => i.name.en));
  await tx.delete(catalogIngredients).where(eq(catalogIngredients.catalogDishId, dishId));
  await tx.delete(catalogSteps).where(eq(catalogSteps.catalogDishId, dishId));
  await tx.insert(catalogIngredients).values(
    input.ingredients.map((i, position) => ({
      catalogDishId: dishId,
      position,
      amount: i.amount,
      unit: i.unit,
      ingredientId: ingredientIds[position],
      nameEn: i.name.en,
      nameFr: orNull(i.name.fr),
      nameAr: orNull(i.name.ar),
      noteEn: orNull(i.note.en),
      noteFr: orNull(i.note.fr),
      noteAr: orNull(i.note.ar),
    })),
  );
  if (input.steps.length > 0) {
    await tx.insert(catalogSteps).values(
      input.steps.map((s, position) => ({
        catalogDishId: dishId,
        position,
        textEn: s.text.en,
        textFr: orNull(s.text.fr),
        textAr: orNull(s.text.ar),
        timerSeconds: s.timerMinutes === null ? null : s.timerMinutes * 60,
      })),
    );
  }
}

/** Create or edit a Discover dish, in EN (required) with FR/AR (flagged when missing). */
export const adminSaveCatalogDish = adminAction
  .metadata({ actionName: "adminSaveCatalogDish" })
  .inputSchema(catalogDishSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const values = {
      slug: input.slug,
      country: input.country,
      course: input.course,
      difficulty: input.difficulty,
      servings: input.servings,
      seasons: input.seasons,
      dietaryTags: input.dietaryTags,
      collections: input.collections,
      featured: input.featured,
      nameEn: input.name.en,
      nameFr: orNull(input.name.fr),
      nameAr: orNull(input.name.ar),
      descriptionEn: input.description.en,
      descriptionFr: orNull(input.description.fr),
      descriptionAr: orNull(input.description.ar),
    };
    const id = await getDb().transaction(async (tx) => {
      const [taken] = await tx
        .select({ id: catalogDishes.id })
        .from(catalogDishes)
        .where(eq(catalogDishes.slug, input.slug))
        .limit(1);
      if (taken && taken.id !== input.id) returnServerError<ActionErrorCode>("conflict");
      let dishId = input.id;
      if (dishId) {
        const updated = await tx
          .update(catalogDishes)
          .set(values)
          .where(eq(catalogDishes.id, dishId))
          .returning({ id: catalogDishes.id });
        if (updated.length === 0) returnServerError<ActionErrorCode>("not_found");
      } else {
        const [row] = await tx.insert(catalogDishes).values(values).returning({ id: catalogDishes.id });
        dishId = row!.id;
      }
      await writeCatalogContents(tx, dishId, input);
      await audit(tx, {
        actorId: ctx.user.id,
        action: input.id ? "admin.catalog_updated" : "admin.catalog_created",
        targetType: "catalog_dish",
        targetId: dishId,
        meta: { slug: input.slug },
        ip: ctx.ip,
      });
      return dishId;
    });
    refresh();
    revalidatePath("/[locale]/discover", "layout");
    return { id };
  });

/** Removes a Discover dish (confirmed first). People's saved copies keep their own text. */
export const adminDeleteCatalogDish = adminAction
  .metadata({ actionName: "adminDeleteCatalogDish" })
  .inputSchema(idSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const [dish] = await tx
        .select({ slug: catalogDishes.slug })
        .from(catalogDishes)
        .where(eq(catalogDishes.id, id))
        .limit(1);
      if (!dish) returnServerError<ActionErrorCode>("not_found");
      await tx.update(dishes).set({ followsCatalog: false }).where(eq(dishes.catalogDishId, id));
      await tx.delete(catalogDishes).where(eq(catalogDishes.id, id));
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.catalog_deleted",
        targetType: "catalog_dish",
        targetId: id,
        meta: { slug: dish.slug },
        ip: ctx.ip,
      });
    });
    refresh();
    revalidatePath("/[locale]/discover", "layout");
    return { id };
  });

async function deleteReview(tx: Executor, adminId: string, id: string, ip: string) {
  const removed = await tx.delete(dishRatings).where(eq(dishRatings.id, id)).returning({ id: dishRatings.id });
  if (removed.length === 0) returnServerError<ActionErrorCode>("not_found");
  await audit(tx, { actorId: adminId, action: "admin.review_deleted", targetType: "review", targetId: id, ip });
}

/** Deleting a review removes its rating too (PRD §3.8). */
export const adminDeleteReview = adminAction
  .metadata({ actionName: "adminDeleteReview" })
  .inputSchema(idSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    await getDb().transaction((tx) => deleteReview(tx, ctx.user.id, id, ctx.ip));
    refresh();
    return { id };
  });

/** Takes a shared dish out of sharing; the owner keeps it. */
export const adminMakeDishPrivate = adminAction
  .metadata({ actionName: "adminMakeDishPrivate" })
  .inputSchema(idSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(dishes)
        .set({ visibility: "private" })
        .where(eq(dishes.id, id))
        .returning({ id: dishes.id });
      if (updated.length === 0) returnServerError<ActionErrorCode>("not_found");
      await tx.delete(dishGroups).where(eq(dishGroups.dishId, id));
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.dish_made_private",
        targetType: "dish",
        targetId: id,
        ip: ctx.ip,
      });
    });
    refresh();
    return { id };
  });

async function deleteDish(tx: Executor, adminId: string, id: string, ip: string) {
  const [removed] = await tx.delete(dishes).where(eq(dishes.id, id)).returning({ imageKey: dishes.imageKey });
  if (!removed) returnServerError<ActionErrorCode>("not_found");
  await audit(tx, { actorId: adminId, action: "admin.dish_deleted", targetType: "dish", targetId: id, ip });
  return removed.imageKey;
}

/** Deletes a dish for good (confirmed first). */
export const adminDeleteDish = adminAction
  .metadata({ actionName: "adminDeleteDish" })
  .inputSchema(idSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const imageKey = await getDb().transaction((tx) => deleteDish(tx, ctx.user.id, id, ctx.ip));
    await removePhotos([imageKey]);
    refresh();
    return { id };
  });

/** Resolve or dismiss a report, optionally removing what was reported or suspending its author. */
export const adminResolveReport = adminAction
  .metadata({ actionName: "adminResolveReport" })
  .inputSchema(resolveReportSchema)
  .action(async ({ parsedInput: input, ctx }) => {
    const photos: (string | null)[] = [];
    await getDb().transaction(async (tx) => {
      const [report] = await tx.select().from(reports).where(eq(reports.id, input.id)).limit(1);
      if (!report) returnServerError<ActionErrorCode>("not_found");
      if (input.action === "remove_content") {
        if (report.targetType === "dish") photos.push(await deleteDish(tx, ctx.user.id, report.targetId, ctx.ip));
        else if (report.targetType === "review") await deleteReview(tx, ctx.user.id, report.targetId, ctx.ip);
        else if (report.targetType === "message") {
          await tx
            .update(messages)
            .set({ content: "", dishId: null, deletedAt: new Date() })
            .where(eq(messages.id, report.targetId));
          await audit(tx, {
            actorId: ctx.user.id,
            action: "admin.message_removed",
            targetType: "message",
            targetId: report.targetId,
            ip: ctx.ip,
          });
        } else returnServerError<ActionErrorCode>("invalid");
      }
      if (input.action === "suspend_user") {
        const ownerId = await ownerOf(tx, report.targetType, report.targetId);
        if (!ownerId || ownerId === ctx.user.id) returnServerError<ActionErrorCode>("invalid");
        await suspend(tx, ctx.user.id, ownerId, true, ctx.ip);
      }
      await tx
        .update(reports)
        .set({
          status: input.status,
          resolution: input.resolution || (input.action === "none" ? null : input.action),
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
        })
        .where(eq(reports.id, report.id));
      await audit(tx, {
        actorId: ctx.user.id,
        action: input.status === "resolved" ? "admin.report_resolved" : "admin.report_dismissed",
        targetType: "report",
        targetId: report.id,
        meta: { action: input.action },
        ip: ctx.ip,
      });
    });
    await removePhotos(photos);
    refresh();
    return { id: input.id };
  });

async function ownerOf(tx: Executor, type: string, id: string): Promise<string | null> {
  if (type === "user") return id;
  if (type === "dish") {
    const [row] = await tx.select({ id: dishes.userId }).from(dishes).where(eq(dishes.id, id)).limit(1);
    return row?.id ?? null;
  }
  if (type === "message") {
    const [row] = await tx.select({ id: messages.senderId }).from(messages).where(eq(messages.id, id)).limit(1);
    return row?.id ?? null;
  }
  const [row] = await tx.select({ id: dishRatings.userId }).from(dishRatings).where(eq(dishRatings.id, id)).limit(1);
  return row?.id ?? null;
}

export const adminSetFeedbackStatus = adminAction
  .metadata({ actionName: "adminSetFeedbackStatus" })
  .inputSchema(feedbackStatusSchema)
  .action(async ({ parsedInput: { id, status }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(feedback)
        .set({ status, resolvedAt: status === "resolved" ? new Date() : null })
        .where(eq(feedback.id, id))
        .returning({ id: feedback.id });
      if (updated.length === 0) returnServerError<ActionErrorCode>("not_found");
      await audit(tx, {
        actorId: ctx.user.id,
        action: status === "resolved" ? "admin.feedback_resolved" : "admin.feedback_reopened",
        targetType: "feedback",
        targetId: id,
        ip: ctx.ip,
      });
    });
    refresh();
    return { id, status };
  });

export const adminDeleteFeedback = adminAction
  .metadata({ actionName: "adminDeleteFeedback" })
  .inputSchema(idSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    await getDb().transaction(async (tx) => {
      const removed = await tx.delete(feedback).where(eq(feedback.id, id)).returning({ id: feedback.id });
      if (removed.length === 0) returnServerError<ActionErrorCode>("not_found");
      await audit(tx, {
        actorId: ctx.user.id,
        action: "admin.feedback_deleted",
        targetType: "feedback",
        targetId: id,
        ip: ctx.ip,
      });
    });
    refresh();
    return { id };
  });
