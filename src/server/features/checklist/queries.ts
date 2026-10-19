import "server-only";

import { and, count, eq, isNull, or } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { cookLog, dishes, friendships, pantryItems, plannedMeals, profiles } from "@/server/db/schema";

import { CHECKLIST_STEPS, type ChecklistDto, type ChecklistStep } from "./dto";

/** "First week" is generous: the card stays for two weeks after signing up. */
const SHOWN_FOR_MS = 14 * 24 * 60 * 60 * 1000;
const DISHES_GOAL = 3;

/**
 * The first-week checklist (PRD §3.1), or null once it's hidden, finished, or
 * the first weeks are over. Every step is read from what the person did.
 */
export const getChecklist = cache(async (now = new Date()): Promise<ChecklistDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  if (now.getTime() - new Date(session.user.createdAt).getTime() > SHOWN_FOR_MS) return null;
  const db = getDb();
  const [[profile], [dishCount], [pantry], [cooked], [planned], [friend]] = await Promise.all([
    db.select({ dismissed: profiles.checklistDismissedAt }).from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({ n: count() })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt))),
    db.select({ id: pantryItems.id }).from(pantryItems).where(eq(pantryItems.userId, userId)).limit(1),
    db.select({ id: cookLog.id }).from(cookLog).where(eq(cookLog.userId, userId)).limit(1),
    db.select({ id: plannedMeals.id }).from(plannedMeals).where(eq(plannedMeals.userId, userId)).limit(1),
    db
      .select({ a: friendships.userAId })
      .from(friendships)
      .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)))
      .limit(1),
  ]);
  if (profile?.dismissed) return null;
  const done: Record<ChecklistStep, boolean> = {
    dishes: (dishCount?.n ?? 0) >= DISHES_GOAL,
    kitchen: Boolean(pantry),
    cook: Boolean(cooked),
    plan: Boolean(planned),
    friend: Boolean(friend),
  };
  const steps = CHECKLIST_STEPS.map((step) => ({ step, done: done[step] }));
  return steps.every((s) => s.done) ? null : { steps };
});
