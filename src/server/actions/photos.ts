"use server";

import { and, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { dishes, profiles } from "@/server/db/schema";
import { findOwnDish } from "@/server/features/dishes/policy";
import { loadDishAllowance } from "@/server/features/dishes/queries";
import { dishIdSchema } from "@/server/features/dishes/schema";
import type { PhotoDto } from "@/server/features/photos/dto";
import type { PhotoPurpose } from "@/server/storage/image";
import { PhotoError, photoUrls, removePhotos, storePhoto } from "@/server/storage/photos";

import { userAction } from "./_clients";

const uploadSchema = z.instanceof(FormData);

/** The uploaded file from the form, re-encoded and stored; every problem is a typed error code. */
async function storeUpload(userId: string, form: FormData, purpose: PhotoPurpose): Promise<string> {
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) returnServerError<ActionErrorCode>("invalid");
  try {
    return await storePhoto(userId, new Uint8Array(await file.arrayBuffer()), purpose);
  } catch (err) {
    if (err instanceof PhotoError)
      returnServerError<ActionErrorCode>(err.problem === "unavailable" ? "unavailable" : "invalid");
    throw err;
  }
}

/** The box, every dish page and their edit forms. */
function refreshDishes() {
  revalidatePath("/[locale]/dishes", "layout");
}

/**
 * Adds or replaces a dish's photo (ARCHITECTURE §5.10). The old one is removed
 * once the new one is saved. Paused, like editing, while the box is over the limit.
 */
export const uploadDishPhoto = userAction
  .metadata({ actionName: "uploadDishPhoto" })
  .inputSchema(uploadSchema)
  .action(async ({ parsedInput: form, ctx }): Promise<{ photo: PhotoDto | null }> => {
    const parsed = dishIdSchema.safeParse({ id: form.get("dishId") });
    if (!parsed.success) returnServerError<ActionErrorCode>("invalid");
    const dish = await findOwnDish(ctx.user.id, parsed.data.id);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    if ((await loadDishAllowance(ctx.user.id)).readOnly) returnServerError<ActionErrorCode>("quota_exceeded");

    const key = await storeUpload(ctx.user.id, form, "dish");
    const previous = await swapDishImage(ctx.user.id, dish.id, key);
    await removePhotos([previous]);
    refreshDishes();
    return { photo: await photoUrls(key) };
  });

export const removeDishPhoto = userAction
  .metadata({ actionName: "removeDishPhoto" })
  .inputSchema(dishIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const dish = await findOwnDish(ctx.user.id, id);
    if (!dish) returnServerError<ActionErrorCode>("not_found");
    if ((await loadDishAllowance(ctx.user.id)).readOnly) returnServerError<ActionErrorCode>("quota_exceeded");
    const previous = await swapDishImage(ctx.user.id, dish.id, null);
    await removePhotos([previous]);
    refreshDishes();
    return { photo: null };
  });

/** Sets the dish's photo key under a row lock and returns the one it replaced. */
async function swapDishImage(userId: string, dishId: string, key: string | null): Promise<string | null> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ imageKey: dishes.imageKey })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.userId, userId)))
      .for("update");
    await tx.update(dishes).set({ imageKey: key }).where(eq(dishes.id, dishId));
    return row?.imageKey ?? null;
  });
}

/** The profile photo (Settings → Profile): cropped square around the most interesting part. */
export const uploadAvatar = userAction
  .metadata({ actionName: "uploadAvatar" })
  .inputSchema(uploadSchema)
  .action(async ({ parsedInput: form, ctx }): Promise<{ photo: PhotoDto | null }> => {
    const key = await storeUpload(ctx.user.id, form, "avatar");
    const previous = await swapAvatar(ctx.user.id, key);
    await removePhotos([previous]);
    revalidatePath("/[locale]", "layout");
    return { photo: await photoUrls(key) };
  });

export const removeAvatar = userAction
  .metadata({ actionName: "removeAvatar" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const previous = await swapAvatar(ctx.user.id, null);
    await removePhotos([previous]);
    revalidatePath("/[locale]", "layout");
    return { photo: null };
  });

async function swapAvatar(userId: string, key: string | null): Promise<string | null> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ avatarKey: profiles.avatarKey })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .for("update");
    await tx.update(profiles).set({ avatarKey: key }).where(eq(profiles.userId, userId));
    return row?.avatarKey ?? null;
  });
}
