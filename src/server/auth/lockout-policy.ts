/**
 * Progressive lockout after failed password logins (PRD §3.1). Pure rules,
 * shared by the server and its tests.
 */

/** From this many failures on, every further failure locks for this long. */
const FINAL_STEP = { failures: 20, seconds: 2 * 60 * 60 };

/** Lock length when failures reach each step. */
export const LOCK_STEPS = [
  { failures: 5, seconds: 60 },
  { failures: 10, seconds: 5 * 60 },
  { failures: 15, seconds: 30 * 60 },
  FINAL_STEP,
] as const;

/** Failures are forgotten after a quiet day. */
export const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;

/** Seconds to lock after this many consecutive failures (0 = no lock). */
export function lockSecondsAfter(failures: number): number {
  if (failures >= FINAL_STEP.failures) return FINAL_STEP.seconds;
  return LOCK_STEPS.find((step) => step.failures === failures)?.seconds ?? 0;
}
