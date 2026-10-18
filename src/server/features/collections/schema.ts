// Shared by the collection actions (authoritative) and their forms (hints).
import { z } from "zod";

export const COLLECTION_NAME_MAX = 60;

const name = z.string().trim().min(1, "collectionNameRequired").max(COLLECTION_NAME_MAX, "collectionNameTooLong");

export const createCollectionSchema = z.object({ name });
export const renameCollectionSchema = z.object({ id: z.uuid(), name });
export const collectionIdSchema = z.object({ id: z.uuid() });
export const setDishCollectionsSchema = z.object({
  dishId: z.uuid(),
  collectionIds: z
    .array(z.uuid())
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, "duplicate"),
});
