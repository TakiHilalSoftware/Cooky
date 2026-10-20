/**
 * A short buzz on key actions (PRD §3.10), where the device supports it.
 * Silent everywhere else (desktops, iOS Safari), so nothing ever depends on it.
 */
export function haptic(kind: "tap" | "success" = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(kind === "tap" ? 10 : [12, 60, 24]);
  } catch {
    // Some browsers throw when vibration isn't allowed yet (no user gesture).
  }
}
