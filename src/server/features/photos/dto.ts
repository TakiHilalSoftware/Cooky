// What the UI may know about a stored photo. Types only: safe for the UI.

/** Signed, short-lived links (10 minutes). Never the storage key. */
export type PhotoDto = { url: string; smallUrl: string };

/** A photo slot on a form: what's there now, and whether uploads work at all. */
export type PhotoSlotDto = { photo: PhotoDto | null; enabled: boolean };
