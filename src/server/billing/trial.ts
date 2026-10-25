import "server-only";

import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";

import type { PaidPlan } from "@config/plans";
import type { Executor } from "@/server/db/client";
import { trialEmailRedemptions, trialRedemptions, user } from "@/server/db/schema";
import { env } from "@/server/env";

import { trialInbox } from "./trial-email";

/** A keyed hash, so the table never holds an address (and can't be reversed by guessing). */
function trialEmailKey(email: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET ?? "cooky-dev")
    .update(`trial:${trialInbox(email)}`)
    .digest("hex");
}

/** Whether this account, or any account on the same inbox (even a deleted one), already had a trial. */
export async function trialUsed(userId: string, email: string, tx: Executor): Promise<boolean> {
  const [[byAccount], [byInbox]] = await Promise.all([
    tx
      .select({ userId: trialRedemptions.userId })
      .from(trialRedemptions)
      .where(eq(trialRedemptions.userId, userId))
      .limit(1),
    tx
      .select({ key: trialEmailRedemptions.emailKey })
      .from(trialEmailRedemptions)
      .where(eq(trialEmailRedemptions.emailKey, trialEmailKey(email)))
      .limit(1),
  ]);
  return Boolean(byAccount || byInbox);
}

/** Records a started trial against the account and its inbox. Idempotent. */
export async function recordTrial(userId: string, plan: PaidPlan, tx: Executor): Promise<void> {
  await tx.insert(trialRedemptions).values({ userId, plan }).onConflictDoNothing();
  const [owner] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (owner) {
    await tx
      .insert(trialEmailRedemptions)
      .values({ emailKey: trialEmailKey(owner.email) })
      .onConflictDoNothing();
  }
}

/**
 * Before an account is purged: its inbox keeps counting as having had the
 * trial. Also covers trials recorded before inbox keys existed.
 */
export async function keepTrialAfterPurge(userId: string, tx: Executor): Promise<void> {
  const [used] = await tx
    .select({ plan: trialRedemptions.plan })
    .from(trialRedemptions)
    .where(eq(trialRedemptions.userId, userId))
    .limit(1);
  if (used) await recordTrial(userId, used.plan, tx);
}
