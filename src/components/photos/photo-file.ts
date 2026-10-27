/** The formats sharp re-encodes. Asking for JPEG makes iPhones convert HEIC photos on the way out. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
/** Matches the server's cap (MAX_PHOTO_BYTES); checked here only to answer instantly. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export type PhotoFileProblem = "tooLarge" | "wrongType";

/** The instant answer before uploading. The server re-checks the bytes and has the last word. */
export function photoFileProblem(file: File): PhotoFileProblem | null {
  if (!PHOTO_ACCEPT.split(",").includes(file.type)) return "wrongType";
  if (file.size > PHOTO_MAX_BYTES) return "tooLarge";
  return null;
}
