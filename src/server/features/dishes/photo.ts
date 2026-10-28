import "server-only";

import type { PhotoDto } from "@/server/features/photos/dto";
import { photoUrls, smallPhotoUrl } from "@/server/storage/photos";

/**
 * Where a dish's photo comes from: the person's own upload, else the photo of
 * the Discover dish it was saved from. Loaders select `catalogPhotoUrl` as
 * `catalogDishes.photoUrl` with a left join on `dishes.catalogDishId`, so a
 * saved Discover dish looks the same on every screen.
 */
export type DishPhotoSource = { imageKey: string | null; catalogPhotoUrl: string | null };

/** The small photo, for lists and cards. */
export async function dishSmallPhotoUrl(dish: DishPhotoSource): Promise<string | null> {
  return (await smallPhotoUrl(dish.imageKey)) ?? dish.catalogPhotoUrl;
}

/** Both sizes, for the dish page. Catalog photos come in one size, used for both. */
export async function dishPhoto(dish: DishPhotoSource): Promise<PhotoDto | null> {
  const own = await photoUrls(dish.imageKey);
  if (own) return own;
  return dish.catalogPhotoUrl ? { url: dish.catalogPhotoUrl, smallUrl: dish.catalogPhotoUrl } : null;
}
