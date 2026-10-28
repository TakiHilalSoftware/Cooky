import "server-only";

import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { assistantMessages, assistantThreads, catalogDishes, type AssistantPick } from "@/server/db/schema";
import { getFeatureUsage } from "@/server/features/billing/queries";
import { loadHave, loadRankableDishes } from "@/server/features/cook/queries";
import { missingFor } from "@/server/features/cook/service";
import { toCatalogCards } from "@/server/features/discover/queries";
import { env } from "@/server/env";
import { dishSmallPhotoUrl } from "@/server/features/dishes/photo";

import type { AssistantMessageDto, AssistantPageDto, AssistantPickDto } from "./dto";

/** ARCHITECTURE §4: assistant history is kept 90 days. */
export const ASSISTANT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const THREADS_LISTED = 30;

/** True when at least one AI provider is configured. */
export function assistantAvailable(): boolean {
  return Boolean(env.GROQ_API_KEY || env.OPENAI_API_KEY);
}

/**
 * Saved picks → cards, re-checked now: a dish deleted since (or no longer the
 * person's) simply disappears; Discover cards show whether it's been saved.
 */
export async function hydratePicks(
  userId: string,
  locale: AppLocale,
  picksPerMessage: AssistantPick[][],
): Promise<AssistantPickDto[][]> {
  const all = picksPerMessage.flat();
  if (all.length === 0) return picksPerMessage.map(() => []);
  const needsMine = all.some((p) => p.kind === "mine");
  const slugs = [...new Set(all.flatMap((p) => (p.kind === "discover" ? [p.slug] : [])))];
  const [rankable, have, catalogRows] = await Promise.all([
    needsMine ? loadRankableDishes(userId, locale) : Promise.resolve([]),
    needsMine ? loadHave(userId, locale) : Promise.resolve([]),
    slugs.length > 0
      ? getDb().select().from(catalogDishes).where(inArray(catalogDishes.slug, slugs))
      : Promise.resolve([]),
  ]);
  const mine = new Map(rankable.map((d) => [d.id, d]));
  const cards = new Map((await toCatalogCards(catalogRows, locale, userId)).map((c) => [c.slug, c]));
  const haveItems = have.map((h) => h.item);

  return Promise.all(
    picksPerMessage.map(async (picks) => {
      const out: AssistantPickDto[] = [];
      for (const pick of picks) {
        if (pick.kind === "mine") {
          const dish = mine.get(pick.dishId);
          if (!dish) continue;
          out.push({
            kind: "mine",
            dishId: dish.id,
            name: dish.name,
            why: pick.why,
            photoUrl: await dishSmallPhotoUrl(dish),
            missing: missingFor(dish.lines, haveItems),
          });
        } else {
          const card = cards.get(pick.slug);
          if (!card) continue;
          out.push({
            kind: "discover",
            slug: card.slug,
            name: card.name,
            why: pick.why,
            description: card.description,
            saved: card.saved,
          });
        }
      }
      return out;
    }),
  );
}

export async function loadThreadMessages(
  userId: string,
  threadId: string,
  locale: AppLocale,
): Promise<AssistantMessageDto[]> {
  const rows = await getDb()
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      picks: assistantMessages.picks,
    })
    .from(assistantMessages)
    .where(eq(assistantMessages.threadId, threadId))
    .orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id));
  const picks = await hydratePicks(
    userId,
    locale,
    rows.map((r) => r.picks),
  );
  return rows.map((r, i) => ({ id: r.id, role: r.role, content: r.content, picks: picks[i] ?? [] }));
}

/** The caller's own thread, or null (someone else's looks missing). */
export async function findOwnThread(userId: string, threadId: string) {
  const [thread] = await getDb()
    .select()
    .from(assistantThreads)
    .where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)))
    .limit(1);
  return thread ?? null;
}

export const getAssistantPage = cache(
  async (threadId: string | null, locale: AppLocale): Promise<AssistantPageDto | null> => {
    const session = await getSession();
    if (!session) return null;
    const userId = session.user.id;
    const [threads, usage, voiceUsage, thread] = await Promise.all([
      getDb()
        .select({ id: assistantThreads.id, title: assistantThreads.title, updatedAt: assistantThreads.updatedAt })
        .from(assistantThreads)
        .where(eq(assistantThreads.userId, userId))
        .orderBy(desc(assistantThreads.updatedAt))
        .limit(THREADS_LISTED),
      getFeatureUsage("assistant"),
      getFeatureUsage("voice"),
      threadId ? findOwnThread(userId, threadId) : Promise.resolve(null),
    ]);
    return {
      threads: threads.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() })),
      thread: thread
        ? { id: thread.id, title: thread.title, messages: await loadThreadMessages(userId, thread.id, locale) }
        : null,
      usage,
      voiceUsage,
      available: assistantAvailable(),
    };
  },
);

/** Retention: conversations untouched for 90 days are removed (with their messages, by cascade). */
export async function pruneAssistantHistory(now = new Date()): Promise<number> {
  const removed = await getDb()
    .delete(assistantThreads)
    .where(lt(assistantThreads.updatedAt, new Date(now.getTime() - ASSISTANT_RETENTION_MS)))
    .returning({ id: assistantThreads.id });
  return removed.length;
}
