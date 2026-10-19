import "server-only";

import type { PhotoDto } from "@/server/features/photos/dto";
import { logger } from "@/server/observability/logger";

import { MAX_PHOTO_BYTES, processImage, sniffImage, type PhotoPurpose } from "./image";
import { copyObject, deleteObjects, putObject, signedUrl, storageConfigured } from "./r2";

export type PhotoProblem = "unavailable" | "too_large" | "not_image" | "unsupported" | "unreadable";

export class PhotoError extends Error {
  constructor(readonly problem: PhotoProblem) {
    super(problem);
  }
}

/** Every object lives under the owner's prefix, so an account purge can remove them all. */
const smallKey = (key: string) => key.replace(/\.webp$/, "-sm.webp");

/**
 * Checks, re-encodes and stores an upload (ARCHITECTURE §5.10). Returns the
 * storage key; the caller saves it and later calls `removePhoto` for the old one.
 */
export async function storePhoto(userId: string, bytes: Uint8Array, purpose: PhotoPurpose): Promise<string> {
  if (!storageConfigured()) throw new PhotoError("unavailable");
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new PhotoError("too_large");
  const kind = sniffImage(bytes);
  if (!kind) throw new PhotoError("not_image");
  // The prebuilt sharp can't decode HEIC; browsers convert it to JPEG when the picker asks for JPEG.
  if (kind === "heic") throw new PhotoError("unsupported");
  const { full, small } = await processImage(bytes, purpose).catch(() => {
    throw new PhotoError("unreadable");
  });
  const key = `u/${userId}/${crypto.randomUUID()}.webp`;
  await Promise.all([putObject(key, full, "image/webp"), putObject(smallKey(key), small, "image/webp")]);
  return key;
}

/**
 * Copies someone else's dish photo under the new owner's prefix, so each copy
 * lives and dies with its own account. Returns the new key.
 */
export async function copyPhoto(fromKey: string, toUserId: string): Promise<string> {
  if (!storageConfigured()) throw new PhotoError("unavailable");
  const key = `u/${toUserId}/${crypto.randomUUID()}.webp`;
  await Promise.all([copyObject(fromKey, key), copyObject(smallKey(fromKey), smallKey(key))]);
  return key;
}

/** Signed read links for a stored photo. Call only once the viewer is allowed to see it. */
export async function photoUrls(key: string | null): Promise<PhotoDto | null> {
  if (!key || !storageConfigured()) return null;
  const [url, smallUrl] = await Promise.all([signedUrl(key), signedUrl(smallKey(key))]);
  return { url, smallUrl };
}

/** The small version only, for lists. */
export async function smallPhotoUrl(key: string | null): Promise<string | null> {
  if (!key || !storageConfigured()) return null;
  return signedUrl(smallKey(key));
}

/**
 * Removes replaced or purged photos. Best effort: a failure leaves an orphan
 * under the owner's prefix for the account purge, never a broken page.
 */
export async function removePhotos(keys: (string | null)[]): Promise<void> {
  const present = keys.filter((key): key is string => Boolean(key));
  if (present.length === 0 || !storageConfigured()) return;
  try {
    await deleteObjects(present.flatMap((key) => [key, smallKey(key)]));
  } catch (err) {
    logger.warn({ err, count: present.length }, "photo delete failed");
  }
}
