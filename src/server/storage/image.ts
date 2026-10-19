import "server-only";

import sharp from "sharp";

/** Phone photos run 2–6 MB; the action body limit is 6 MB. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type PhotoPurpose = "dish" | "avatar";

/** What the bytes really are (the browser's MIME type is only a claim). */
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | "gif" | "avif" | "heic" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export class UnreadableImage extends Error {}

/** The sizes kept for each purpose: the full one and a small one for lists. */
const SIZES = {
  dish: { full: { width: 1280, height: 1280, fit: "inside" }, small: { width: 480, height: 360, fit: "cover" } },
  // Profile photos are square; the crop centres on the most interesting part (a face, usually).
  avatar: { full: { width: 512, height: 512, fit: "cover" }, small: { width: 96, height: 96, fit: "cover" } },
} as const;

/**
 * Re-encodes an upload (ARCHITECTURE §5.10): turned upright from the EXIF
 * orientation, resized, saved as WebP. sharp writes no metadata unless asked,
 * so EXIF, GPS and camera details are gone. Only the first frame of an
 * animation is kept.
 */
export async function processImage(bytes: Uint8Array, purpose: PhotoPurpose): Promise<{ full: Buffer; small: Buffer }> {
  const sizes = SIZES[purpose];
  // 40 MP covers any phone camera; bigger is refused before decoding.
  const source = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000, autoOrient: true });
  const render = (size: (typeof sizes)["full" | "small"]) =>
    source
      .clone()
      .resize({ ...size, withoutEnlargement: true, position: sharp.strategy.attention })
      .webp({ quality: 80 })
      .toBuffer();
  try {
    const [full, small] = await Promise.all([render(sizes.full), render(sizes.small)]);
    return { full, small };
  } catch {
    throw new UnreadableImage();
  }
}
